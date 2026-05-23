import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  UpdateTransactionParams,
  DeleteTransactionParams,
  GetTransactionParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/transactions", async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }
  const { type, categoryId, startDate, endDate } = parsed.data;

  const conditions = [];
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
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${transactionsTable.date} desc, ${transactionsTable.createdAt} desc`);

  const result = rows.map((r) => ({
    ...r,
    amount: parseFloat(r.amount),
    createdAt: r.createdAt.toISOString(),
  }));

  return res.json(result);
});

router.post("/transactions", async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  const { type, amount, description, date, categoryId, notes } = parsed.data;

  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId))
    .limit(1);

  if (!category) {
    return res.status(400).json({ error: "Category not found" });
  }

  const [row] = await db
    .insert(transactionsTable)
    .values({ type, amount: String(amount), description, date, categoryId, notes: notes ?? null })
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
    .where(eq(transactionsTable.id, parsed.data.id))
    .limit(1);

  if (!row) return res.status(404).json({ error: "Not found" });

  return res.json({
    ...row,
    amount: parseFloat(row.amount),
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/transactions/:id", async (req, res) => {
  const paramParsed = UpdateTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateTransactionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid body", details: bodyParsed.error.issues });
  }

  const { type, amount, description, date, categoryId, notes } = bodyParsed.data;
  const updates: Record<string, unknown> = {};
  if (type !== undefined) updates.type = type;
  if (amount !== undefined) updates.amount = String(amount);
  if (description !== undefined) updates.description = description;
  if (date !== undefined) updates.date = date;
  if (categoryId !== undefined) updates.categoryId = categoryId;
  if (notes !== undefined) updates.notes = notes;

  const [row] = await db
    .update(transactionsTable)
    .set(updates)
    .where(eq(transactionsTable.id, paramParsed.data.id))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });

  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, row.categoryId))
    .limit(1);

  return res.json({
    ...row,
    amount: parseFloat(row.amount),
    categoryName: category?.name ?? "",
    categoryColor: category?.color ?? "",
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/transactions", async (_req, res) => {
  await db.delete(transactionsTable);
  return res.status(204).send();
});

router.delete("/transactions/:id", async (req, res) => {
  const parsed = DeleteTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  await db.delete(transactionsTable).where(eq(transactionsTable.id, parsed.data.id));
  return res.status(204).send();
});

export default router;
