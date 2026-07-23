import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable, billLogsTable, billsTable, goalContributionsTable, goalsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  UpdateTransactionParams,
  DeleteTransactionParams,
  GetTransactionParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

router.get("/transactions", async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

  const { type, categoryId, startDate, endDate } = parsed.data;
  const userId = (req as any).userId;

  const conditions = [eq(transactionsTable.userId, userId)];
  if (type) conditions.push(eq(transactionsTable.type, type));
  if (categoryId != null) conditions.push(eq(transactionsTable.categoryId, Number(categoryId)));
  if (startDate) conditions.push(gte(transactionsTable.date, startDate));
  if (endDate) conditions.push(lte(transactionsTable.date, endDate));

  const rows = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      description: transactionsTable.description,
      date: transactionsTable.date,
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      notes: transactionsTable.notes,
      createdAt: transactionsTable.createdAt,
      // Nombre del Flow/meta si esta transacción nació de un auto-save o de un
      // aporte — para poder avisar antes de borrarla que también va a
      // desmarcar el Flow / restar el aporte (ver DELETE /transactions/:id).
      linkedBillName: billsTable.name,
      linkedGoalName: goalsTable.name,
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .leftJoin(billLogsTable, eq(billLogsTable.transactionId, transactionsTable.id))
    .leftJoin(billsTable, eq(billsTable.id, billLogsTable.billId))
    .leftJoin(goalContributionsTable, eq(goalContributionsTable.transactionId, transactionsTable.id))
    .leftJoin(goalsTable, eq(goalsTable.id, goalContributionsTable.goalId))
    .where(and(...conditions))
    .orderBy(sql`${transactionsTable.date} desc, ${transactionsTable.createdAt} desc`);

  return res.json(rows.map((r) => ({
    ...r,
    amount: parseFloat(r.amount),
    createdAt: r.createdAt.toISOString(),
    linkedBillName: r.linkedBillName ?? null,
    linkedGoalName: r.linkedGoalName ?? null,
  })));
});

router.post("/transactions", async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const { type, amount, description, date, categoryId, notes } = parsed.data;
  const userId = (req as any).userId;

  const [category] = await db.select().from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.userId, userId)))
    .limit(1);

  if (!category) return res.status(400).json({ error: "Category not found" });

  const [row] = await db.insert(transactionsTable)
    .values({ type, amount: String(amount), description, date, categoryId, notes: notes ?? null, userId })
    .returning();

  return res.status(201).json({
    ...row,
    amount: parseFloat(row.amount),
    categoryName: category.name,
    categoryColor: category.color,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get("/transactions/:id", async (req, res) => {
  const parsed = GetTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;

  const [row] = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      description: transactionsTable.description,
      date: transactionsTable.date,
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      notes: transactionsTable.notes,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(and(eq(transactionsTable.id, parsed.data.id), eq(transactionsTable.userId, userId)))
    .limit(1);

  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json({ ...row, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString() });
});

router.patch("/transactions/:id", async (req, res) => {
  const paramParsed = UpdateTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateTransactionBody.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json({ error: "Invalid body", details: bodyParsed.error.issues });

  const userId = (req as any).userId;
  const { type, amount, description, date, categoryId, notes } = bodyParsed.data;

  // Si el monto cambia y esta transacción está atada a un Flow o a un aporte de
  // meta, hay que propagar el cambio (ver más abajo) — necesitamos el monto
  // VIEJO de acá porque currentAmount de una meta es un acumulado compartido
  // con otros aportes, no se puede simplemente pisar con el nuevo valor.
  const [before] = amount !== undefined
    ? await db.select({ amount: transactionsTable.amount }).from(transactionsTable)
        .where(and(eq(transactionsTable.id, paramParsed.data.id), eq(transactionsTable.userId, userId)))
        .limit(1)
    : [undefined];

  const updates: Record<string, unknown> = {};
  if (type !== undefined) updates.type = type;
  if (amount !== undefined) updates.amount = String(amount);
  if (description !== undefined) updates.description = description;
  if (date !== undefined) updates.date = date;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (notes !== undefined) updates.notes = notes;

  const [row] = await db.update(transactionsTable)
    .set(updates)
    .where(and(eq(transactionsTable.id, paramParsed.data.id), eq(transactionsTable.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });

  if (amount !== undefined && before) {
    const delta = amount - parseFloat(before.amount);
    if (delta !== 0) {
      // Flow: amountPaid es solo "cuánto se pagó realmente" — no lo comparte
      // nadie más, se pisa directo con el monto nuevo.
      await db.update(billLogsTable)
        .set({ amountPaid: String(amount) })
        .where(eq(billLogsTable.transactionId, row.id));

      // Meta: currentAmount SÍ es un acumulado compartido con otros aportes —
      // hay que sumar/restar la diferencia, no pisarlo.
      const [contribution] = await db
        .select({ goalId: goalContributionsTable.goalId })
        .from(goalContributionsTable)
        .where(eq(goalContributionsTable.transactionId, row.id))
        .limit(1);
      if (contribution) {
        await db.update(goalContributionsTable)
          .set({ amount: String(amount) })
          .where(eq(goalContributionsTable.transactionId, row.id));
        await db.update(goalsTable)
          .set({ currentAmount: sql`${goalsTable.currentAmount} + ${String(delta)}` })
          .where(eq(goalsTable.id, contribution.goalId));
      }
    }
  }

  const [category] = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.id, row.categoryId)).limit(1);

  return res.json({
    ...row,
    amount: parseFloat(row.amount),
    categoryName: category?.name ?? "",
    categoryColor: category?.color ?? "",
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/transactions", async (req, res) => {
  const userId = (req as any).userId;
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
  return res.status(204).send();
});

router.delete("/transactions/:id", async (req, res) => {
  const parsed = DeleteTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;

  // Si esta transacción nació de un Flow con auto-save, hay que desmarcarlo
  // también (dismissed=true, mismo mecanismo que el unmark manual desde
  // Goals) — si no, el Flow se queda marcado como pagado apuntando a una
  // transacción que ya no existe.
  const linkedLogs = await db
    .select({ id: billLogsTable.id })
    .from(billLogsTable)
    .where(eq(billLogsTable.transactionId, parsed.data.id));

  // Mismo problema del otro lado: si nació de un "Add money" a una meta, hay
  // que deshacer el aporte — acá no hay concepto de "dismissed" (un aporte no
  // es un estado mensual con auto-heal, es un evento puntual), así que se
  // borra el registro entero y se resta lo que había sumado a currentAmount.
  const linkedContributions = await db
    .select({ id: goalContributionsTable.id, goalId: goalContributionsTable.goalId, amount: goalContributionsTable.amount })
    .from(goalContributionsTable)
    .where(eq(goalContributionsTable.transactionId, parsed.data.id));

  const [deleted] = await db.delete(transactionsTable)
    .where(and(eq(transactionsTable.id, parsed.data.id), eq(transactionsTable.userId, userId)))
    .returning();

  if (!deleted) return res.status(404).json({ error: "Not found" });

  if (linkedLogs.length > 0) {
    await db.update(billLogsTable)
      .set({ dismissed: true })
      .where(inArray(billLogsTable.id, linkedLogs.map((l) => l.id)));
  }

  for (const c of linkedContributions) {
    await db.update(goalsTable)
      .set({ currentAmount: sql`${goalsTable.currentAmount} - ${c.amount}` })
      .where(eq(goalsTable.id, c.goalId));
  }
  if (linkedContributions.length > 0) {
    await db.delete(goalContributionsTable)
      .where(inArray(goalContributionsTable.id, linkedContributions.map((c) => c.id)));
  }

  return res.status(204).send();
});

export default router;
