import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

router.get("/categories", async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.userId, userId))
    .orderBy(categoriesTable.name);
  return res.json(rows);
});

router.post("/categories", async (req, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
  }
  const userId = (req as any).userId;
  const [row] = await db.insert(categoriesTable).values({ ...parsed.data, userId }).returning();
  return res.status(201).json(row);
});

router.patch("/categories/:id", async (req, res) => {
  const paramParsed = UpdateCategoryParams.safeParse({ id: Number(req.params.id) });
  if (!paramParsed.success) return res.status(400).json({ error: "Invalid id" });

  const bodyParsed = UpdateCategoryBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid body", details: bodyParsed.error.issues });
  }

  const userId = (req as any).userId;
  const updates: Record<string, unknown> = {};
  const { name, type, color, icon } = bodyParsed.data;
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (color !== undefined) updates.color = color;
  if (icon !== undefined) updates.icon = icon;

  const [row] = await db
    .update(categoriesTable)
    .set(updates)
    .where(and(eq(categoriesTable.id, paramParsed.data.id), eq(categoriesTable.userId, userId)))
    .returning();

  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.delete("/categories/:id", async (req, res) => {
  const parsed = DeleteCategoryParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) return res.status(400).json({ error: "Invalid id" });

  const userId = (req as any).userId;
  await db.delete(categoriesTable)
    .where(and(eq(categoriesTable.id, parsed.data.id), eq(categoriesTable.userId, userId)));
  return res.status(204).send();
});

export default router;
