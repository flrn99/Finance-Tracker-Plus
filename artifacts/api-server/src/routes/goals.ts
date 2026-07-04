import { Router } from "express";
import { db } from "@workspace/db";
import { goalsTable, habitsTable, habitLogsTable } from "@workspace/db";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
  await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));
  return res.status(204).send();
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

export default router;
