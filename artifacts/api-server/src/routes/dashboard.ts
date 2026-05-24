import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import {
  GetDashboardSummaryQueryParams,
  GetSpendingByCategoryQueryParams,
  GetTopExpensesQueryParams,
} from "@workspace/api-zod";

const router = Router();

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const startDate = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

function resolveDateRange(data: {
  month?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  allTime?: boolean | null;
}): { startDate: string; endDate: string } | null {
  if (data.allTime) return null;
  if (data.startDate || data.endDate) {
    return {
      startDate: data.startDate ?? "1900-01-01",
      endDate: data.endDate ?? "2099-12-31",
    };
  }
  return monthRange(data.month ?? currentMonth());
}

router.get("/dashboard/summary", async (req, res) => {
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });

  const range = resolveDateRange(parsed.data);

  const rows = await db
    .select({
      type: transactionsTable.type,
      amount: transactionsTable.amount,
    })
    .from(transactionsTable)
    .where(
      range
        ? and(
            gte(transactionsTable.date, range.startDate),
            lte(transactionsTable.date, range.endDate)
          )
        : undefined
    );

  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const row of rows) {
    const amount = parseFloat(row.amount);
    if (row.type === "income") {
      totalIncome += amount;
      incomeCount++;
    } else {
      totalExpenses += amount;
      expenseCount++;
    }
  }

  return res.json({
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    transactionCount: rows.length,
    incomeCount,
    expenseCount,
  });
});

router.get("/dashboard/spending-by-category", async (req, res) => {
  const parsed = GetSpendingByCategoryQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });

  const range = resolveDateRange(parsed.data);

  const rows = await db
    .select({
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
      amount: transactionsTable.amount,
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(
      (() => {
        const txType = parsed.data.type ?? "expense";
        return range
          ? and(
              eq(transactionsTable.type, txType),
              gte(transactionsTable.date, range.startDate),
              lte(transactionsTable.date, range.endDate)
            )
          : eq(transactionsTable.type, txType);
      })()
    );

  const grouped: Record<
    number,
    { categoryId: number; categoryName: string; categoryColor: string; categoryIcon: string; total: number; count: number }
  > = {};

  for (const row of rows) {
    const id = row.categoryId;
    if (!grouped[id]) {
      grouped[id] = {
        categoryId: id,
        categoryName: row.categoryName,
        categoryColor: row.categoryColor,
        categoryIcon: row.categoryIcon,
        total: 0,
        count: 0,
      };
    }
    grouped[id].total += parseFloat(row.amount);
    grouped[id].count++;
  }

  const items = Object.values(grouped).sort((a, b) => b.total - a.total);
  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  const result = items.map((item) => ({
    ...item,
    total: Math.round(item.total * 100) / 100,
    percentage: grandTotal > 0 ? Math.round((item.total / grandTotal) * 10000) / 100 : 0,
  }));

  return res.json(result);
});

router.get("/dashboard/monthly-trend", async (_req, res) => {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const startDate = `${firstMonth}-01`;
  const lastDay = new Date(
    parseInt(lastMonth.split("-")[0]),
    parseInt(lastMonth.split("-")[1]),
    0
  ).getDate();
  const endDate = `${lastMonth}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select({
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      date: transactionsTable.date,
    })
    .from(transactionsTable)
    .where(
      and(
        gte(transactionsTable.date, startDate),
        lte(transactionsTable.date, endDate)
      )
    );

  const trend: Record<string, { income: number; expenses: number }> = {};
  for (const m of months) trend[m] = { income: 0, expenses: 0 };

  for (const row of rows) {
    const m = row.date.substring(0, 7);
    if (!trend[m]) continue;
    const amount = parseFloat(row.amount);
    if (row.type === "income") trend[m].income += amount;
    else trend[m].expenses += amount;
  }

  const result = months.map((m) => ({
    month: m,
    income: Math.round(trend[m].income * 100) / 100,
    expenses: Math.round(trend[m].expenses * 100) / 100,
    balance: Math.round((trend[m].income - trend[m].expenses) * 100) / 100,
  }));

  return res.json(result);
});

router.get("/dashboard/top-expenses", async (req, res) => {
  const parsed = GetTopExpensesQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });

  const range = resolveDateRange(parsed.data);
  const limit = parsed.data.limit ?? 5;

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
    .where(
      range
        ? and(
            eq(transactionsTable.type, "expense"),
            gte(transactionsTable.date, range.startDate),
            lte(transactionsTable.date, range.endDate)
          )
        : eq(transactionsTable.type, "expense")
    )
    .orderBy(desc(sql`CAST(${transactionsTable.amount} AS numeric)`))
    .limit(limit);

  const result = rows.map((r) => ({
    ...r,
    amount: parseFloat(r.amount),
    createdAt: r.createdAt.toISOString(),
  }));

  return res.json(result);
});

export default router;
