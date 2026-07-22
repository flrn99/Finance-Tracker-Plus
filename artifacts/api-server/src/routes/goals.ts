import { Router } from "express";
import { db } from "@workspace/db";
import { goalsTable, goalContributionsTable, habitsTable, habitLogsTable, billsTable, billLogsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const goalBodySchema = z.object({
  name: z.string().min(1),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().min(0).optional(),
  icon: z.string().nullish(),
  color: z.string().nullish(),
});

const habitBodySchema = z.object({
  name: z.string().min(1),
  icon: z.string().nullish(),
  color: z.string().nullish(),
});

const billBodySchema = z.object({
  name: z.string().min(1),
  icon: z.string().nullish(),
  color: z.string().nullish(),
  type: z.enum(["expense", "income"]).optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
  amount: z.coerce.number().nonnegative().nullish(),
  categoryId: z.coerce.number().int().positive().nullish(),
  autoSave: z.boolean().optional(),
});

const billLogBodySchema = z.object({
  amountPaid: z.coerce.number().nonnegative().nullish(),
  transactionId: z.coerce.number().int().positive().nullish(),
});

const goalContributionBodySchema = z.object({
  amount: z.coerce.number().positive(),
  transactionId: z.coerce.number().int().positive().nullish(),
});

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  const toKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const cursor = new Date();
  // Si hoy no está marcado, la racha puede seguir viva desde ayer
  if (!set.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (set.has(toKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- GOALS ----------

router.get("/goals", async (req, res) => {
  const userId = (req as any).userId;

  const rows = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(desc(goalsTable.createdAt));

  return res.json(
    rows.map((r) => ({
      ...r,
      targetAmount: parseFloat(r.targetAmount),
      currentAmount: parseFloat(r.currentAmount),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/goals", async (req, res) => {
  const parsed = goalBodySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const { name, targetAmount, currentAmount, icon, color } = parsed.data;

  const [row] = await db
    .insert(goalsTable)
    .values({
      name,
      targetAmount: String(targetAmount),
      currentAmount: String(currentAmount ?? 0),
      icon: icon ?? null,
      color: color ?? null,
      userId,
    })
    .returning();

  return res.status(201).json({
    ...row,
    targetAmount: parseFloat(row.targetAmount),
    currentAmount: parseFloat(row.currentAmount),
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/goals/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = goalBodySchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const { name, targetAmount, currentAmount, icon, color } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (targetAmount !== undefined) updates.targetAmount = String(targetAmount);
  if (currentAmount !== undefined) updates.currentAmount = String(currentAmount);
  if (icon !== undefined) updates.icon = icon;
  if (color !== undefined) updates.color = color;

  const [row] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json({
    ...row,
    targetAmount: parseFloat(row.targetAmount),
    currentAmount: parseFloat(row.currentAmount),
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/goals/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;
  // goal_contributions se borra solo (onDelete: cascade) — las transacciones reales
  // que cada aporte generó NO se tocan, igual que bills sin ?deleteTransactions=true:
  // es plata que de verdad se movió, no algo que desaparece porque se borró la meta.
  await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));
  return res.status(204).send();
});

// Registra un aporte a la meta: guarda el log (con el link a la transacción real, si
// el front ya la creó) y suma el monto a currentAmount de forma atómica en SQL, para
// no pisar aportes concurrentes con un valor absoluto stale leído en el cliente.
router.post("/goals/:id/contributions", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = goalContributionBodySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)))
    .limit(1);
  if (!goal) return res.status(404).json({ error: "Not found" });

  const { amount, transactionId } = parsed.data;

  await db.insert(goalContributionsTable).values({
    goalId: id,
    amount: String(amount),
    transactionId: transactionId ?? null,
  });

  const [row] = await db
    .update(goalsTable)
    .set({ currentAmount: sql`${goalsTable.currentAmount} + ${String(amount)}` })
    .where(eq(goalsTable.id, id))
    .returning();

  return res.status(201).json({
    ...row,
    targetAmount: parseFloat(row.targetAmount),
    currentAmount: parseFloat(row.currentAmount),
    createdAt: row.createdAt.toISOString(),
  });
});

// ---------- HABITS ----------

router.get("/habits", async (req, res) => {
  const userId = (req as any).userId;
  const from =
    typeof req.query.from === "string" && dateSchema.safeParse(req.query.from).success
      ? req.query.from
      : null;

  const habits = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.userId, userId))
    .orderBy(desc(habitsTable.createdAt));

  if (habits.length === 0) return res.json([]);

  const habitIds = habits.map((h) => h.id);

  const allLogs = await db
    .select({ habitId: habitLogsTable.habitId, date: habitLogsTable.date })
    .from(habitLogsTable)
    .where(inArray(habitLogsTable.habitId, habitIds));

  const visibleLogs = from ? allLogs.filter((l) => l.date >= from) : allLogs;

  return res.json(
    habits.map((h) => ({
      ...h,
      createdAt: h.createdAt.toISOString(),
      logs: visibleLogs.filter((l) => l.habitId === h.id).map((l) => l.date),
      streak: computeStreak(
        allLogs.filter((l) => l.habitId === h.id).map((l) => l.date),
      ),
    })),
  );
});

router.post("/habits", async (req, res) => {
  const parsed = habitBodySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const { name, icon, color } = parsed.data;

  const [row] = await db
    .insert(habitsTable)
    .values({ name, icon: icon ?? null, color: color ?? null, userId })
    .returning();

  return res.status(201).json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    logs: [],
    streak: 0,
  });
});

router.patch("/habits/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = habitBodySchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;

  const [row] = await db
    .update(habitsTable)
    .set(updates)
    .where(and(eq(habitsTable.id, id), eq(habitsTable.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/habits/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, id), eq(habitsTable.userId, userId)))
    .limit(1);
  if (!habit) return res.status(404).json({ error: "Not found" });

  await db.delete(habitLogsTable).where(eq(habitLogsTable.habitId, id));
  await db.delete(habitsTable).where(eq(habitsTable.id, id));
  return res.status(204).send();
});

router.get("/habits/:id/logs", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, id), eq(habitsTable.userId, userId)))
    .limit(1);
  if (!habit) return res.status(404).json({ error: "Not found" });

  const conditions = [eq(habitLogsTable.habitId, id)];
  if (typeof req.query.from === "string" && dateSchema.safeParse(req.query.from).success)
    conditions.push(gte(habitLogsTable.date, req.query.from));
  if (typeof req.query.to === "string" && dateSchema.safeParse(req.query.to).success)
    conditions.push(lte(habitLogsTable.date, req.query.to));

  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(and(...conditions));

  const allLogs = await db
    .select({ date: habitLogsTable.date })
    .from(habitLogsTable)
    .where(eq(habitLogsTable.habitId, id));

  return res.json({
    dates: logs.map((l) => l.date),
    streak: computeStreak(allLogs.map((l) => l.date)),
  });
});

router.put("/habits/:id/logs/:date", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const dateParsed = dateSchema.safeParse(req.params.date);
  if (!dateParsed.success)
    return res.status(400).json({ error: "Invalid date, expected YYYY-MM-DD" });
  const date = dateParsed.data;

  const userId = (req as any).userId;
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, id), eq(habitsTable.userId, userId)))
    .limit(1);
  if (!habit) return res.status(404).json({ error: "Not found" });

  const [existing] = await db
    .select()
    .from(habitLogsTable)
    .where(and(eq(habitLogsTable.habitId, id), eq(habitLogsTable.date, date)))
    .limit(1);

  if (existing) {
    await db.delete(habitLogsTable).where(eq(habitLogsTable.id, existing.id));
    return res.json({ date, completed: false });
  }

  await db.insert(habitLogsTable).values({ habitId: id, date });
  return res.json({ date, completed: true });
});

// ---------- BILLS ----------

router.get("/bills", async (req, res) => {
  const userId = (req as any).userId;

  const bills = await db
    .select()
    .from(billsTable)
    .where(eq(billsTable.userId, userId))
    .orderBy(desc(billsTable.createdAt));

  if (bills.length === 0) return res.json([]);

  const billIds = bills.map((b) => b.id);
  const allLogs = await db
    .select({ billId: billLogsTable.billId, month: billLogsTable.month, transactionId: billLogsTable.transactionId })
    .from(billLogsTable)
    .where(inArray(billLogsTable.billId, billIds));

  const thisMonth = currentMonthKey();

  return res.json(
    bills.map((b) => ({
      ...b,
      amount: b.amount !== null ? parseFloat(b.amount) : null,
      createdAt: b.createdAt.toISOString(),
      logs: allLogs.filter((l) => l.billId === b.id).map((l) => l.month),
      monthsWithTransaction: allLogs.filter((l) => l.billId === b.id && l.transactionId !== null).map((l) => l.month),
      paidThisMonth: allLogs.some((l) => l.billId === b.id && l.month === thisMonth),
      linkedTransactionCount: allLogs.filter((l) => l.billId === b.id && l.transactionId !== null).length,
    })),
  );
});

router.post("/bills", async (req, res) => {
  const parsed = billBodySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const { name, icon, color, type, day, amount, categoryId, autoSave } = parsed.data;

  const [row] = await db
    .insert(billsTable)
    .values({
      name,
      icon: icon ?? null,
      color: color ?? null,
      type: type ?? "expense",
      day: day ?? 1,
      amount: amount != null ? String(amount) : null,
      categoryId: categoryId ?? null,
      autoSave: autoSave ?? false,
      userId,
    })
    .returning();

  return res.status(201).json({
    ...row,
    amount: row.amount !== null ? parseFloat(row.amount) : null,
    createdAt: row.createdAt.toISOString(),
    logs: [],
    monthsWithTransaction: [],
    paidThisMonth: false,
    linkedTransactionCount: 0,
  });
});

router.patch("/bills/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = billBodySchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = (req as any).userId;
  const { name, icon, color, type, day, amount, categoryId, autoSave } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (icon !== undefined) updates.icon = icon;
  if (color !== undefined) updates.color = color;
  if (type !== undefined) updates.type = type;
  if (day !== undefined) updates.day = day;
  if (amount !== undefined) updates.amount = amount != null ? String(amount) : null;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (autoSave !== undefined) updates.autoSave = autoSave;

  const [row] = await db
    .update(billsTable)
    .set(updates)
    .where(and(eq(billsTable.id, id), eq(billsTable.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json({
    ...row,
    amount: row.amount !== null ? parseFloat(row.amount) : null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/bills/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;
  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(eq(billsTable.id, id), eq(billsTable.userId, userId)))
    .limit(1);
  if (!bill) return res.status(404).json({ error: "Not found" });

  // Si el front pide borrar también las transacciones reales creadas por auto-save
  // (?deleteTransactions=true), las recolectamos ANTES de borrar los logs (que las
  // referencian) — son transacciones de este mismo usuario porque nacieron de un
  // bill suyo, no hace falta re-validar userId por transacción.
  if (req.query.deleteTransactions === "true") {
    const logsWithTx = await db
      .select({ transactionId: billLogsTable.transactionId })
      .from(billLogsTable)
      .where(eq(billLogsTable.billId, id));
    const txIds = logsWithTx.map((l) => l.transactionId).filter((t): t is number => t !== null);
    if (txIds.length > 0) {
      await db.delete(transactionsTable).where(inArray(transactionsTable.id, txIds));
    }
  }

  await db.delete(billLogsTable).where(eq(billLogsTable.billId, id));
  await db.delete(billsTable).where(eq(billsTable.id, id));
  return res.status(204).send();
});

router.get("/bills/:id/logs", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;
  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(eq(billsTable.id, id), eq(billsTable.userId, userId)))
    .limit(1);
  if (!bill) return res.status(404).json({ error: "Not found" });

  const conditions = [eq(billLogsTable.billId, id)];
  if (typeof req.query.from === "string" && monthSchema.safeParse(req.query.from).success)
    conditions.push(gte(billLogsTable.month, req.query.from));
  if (typeof req.query.to === "string" && monthSchema.safeParse(req.query.to).success)
    conditions.push(lte(billLogsTable.month, req.query.to));

  const logs = await db
    .select()
    .from(billLogsTable)
    .where(and(...conditions));

  return res.json({ months: logs.map((l) => l.month) });
});

// Marca/desmarca un mes como pagado. Al marcar, opcionalmente guarda el monto real
// pagado y el id de la transacción creada (si el front la generó vía auto-save).
// Al desmarcar, si ese mes tenía una transacción vinculada, se borra junto con el
// registro de "pagado" — el front ya pidió confirmación explícita antes de llamar
// a este endpoint (ver ConfirmDialog de unmark en goals.tsx), así que no es un
// efecto secundario silencioso.
router.put("/bills/:id/logs/:month", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const monthParsed = monthSchema.safeParse(req.params.month);
  if (!monthParsed.success)
    return res.status(400).json({ error: "Invalid month, expected YYYY-MM" });
  const month = monthParsed.data;

  const userId = (req as any).userId;
  const [bill] = await db
    .select()
    .from(billsTable)
    .where(and(eq(billsTable.id, id), eq(billsTable.userId, userId)))
    .limit(1);
  if (!bill) return res.status(404).json({ error: "Not found" });

  // DELETE...RETURNING es atómico en Postgres y borra TODAS las filas que matcheen
  // (billId, month) de una — antes se hacía SELECT + DELETE por id, y si una carrera
  // dejaba más de una fila duplicada para el mismo mes, solo se borraba una, dejando
  // el mes "pagado" fantasma (el bug de "a veces no me lo quita").
  const deleted = await db
    .delete(billLogsTable)
    .where(and(eq(billLogsTable.billId, id), eq(billLogsTable.month, month)))
    .returning();

  if (deleted.length > 0) {
    const txIds = deleted.map((l) => l.transactionId).filter((t): t is number => t !== null);
    if (txIds.length > 0) {
      await db.delete(transactionsTable).where(inArray(transactionsTable.id, txIds));
    }
    return res.json({ month, paid: false });
  }

  const bodyParsed = billLogBodySchema.safeParse(req.body ?? {});
  const { amountPaid, transactionId } = bodyParsed.success ? bodyParsed.data : {};

  // onConflictDoNothing: si dos requests concurrentes intentan marcar el mismo mes
  // como pagado a la vez, el constraint único (billId, month) hace que la segunda
  // inserción sea un no-op en vez de crear una fila duplicada.
  await db
    .insert(billLogsTable)
    .values({
      billId: id,
      month,
      amountPaid: amountPaid != null ? String(amountPaid) : null,
      transactionId: transactionId ?? null,
    })
    .onConflictDoNothing({ target: [billLogsTable.billId, billLogsTable.month] });

  return res.json({ month, paid: true });
});

export default router;
