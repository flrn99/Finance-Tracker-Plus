import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import * as XLSX from "xlsx";
import { ExportToExcelQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/export/excel", async (req, res) => {
  const parsed = ExportToExcelQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });

  const { startDate, endDate } = parsed.data;

  const conditions = [];
  if (startDate) conditions.push(gte(transactionsTable.date, startDate));
  if (endDate) conditions.push(lte(transactionsTable.date, endDate));

  const rows = await db
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      description: transactionsTable.description,
      date: transactionsTable.date,
      categoryName: categoriesTable.name,
      categoryType: categoriesTable.type,
      notes: transactionsTable.notes,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(transactionsTable.date);

  const data = rows.map((r) => ({
    ID: r.id,
    Date: r.date,
    Type: r.type.charAt(0).toUpperCase() + r.type.slice(1),
    Description: r.description,
    Category: r.categoryName,
    Amount: parseFloat(r.amount),
    Notes: r.notes ?? "",
    "Created At": r.createdAt.toISOString(),
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  ws["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
    { wch: 12 },
    { wch: 25 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");

  const summaryData = [
    { Metric: "Total Rows", Value: data.length },
    {
      Metric: "Total Income",
      Value: data.filter((d) => d.Type === "Income").reduce((s, d) => s + d.Amount, 0),
    },
    {
      Metric: "Total Expenses",
      Value: data.filter((d) => d.Type === "Expense").reduce((s, d) => s + d.Amount, 0),
    },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.xlsx"`
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  return res.send(buf);
});

export default router;
