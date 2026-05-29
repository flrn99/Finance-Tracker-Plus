import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";
import { ExportToExcelQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

router.get("/export/excel", async (req, res) => {
  const parsed = ExportToExcelQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid params" });

  const { startDate, endDate } = parsed.data;
  const userId = (req as any).userId;

  const conditions = [eq(transactionsTable.userId, userId)];
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
      notes: transactionsTable.notes,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(transactionsTable.date);

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinanceFlow";
  wb.created = new Date();

  // ── Transactions sheet ──────────────────────────────────────────
  const ws = wb.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "ID",          key: "id",          width: 8  },
    { header: "Date",        key: "date",         width: 14 },
    { header: "Type",        key: "type",         width: 12 },
    { header: "Description", key: "description",  width: 32 },
    { header: "Category",    key: "category",     width: 20 },
    { header: "Amount",      key: "amount",       width: 14 },
    { header: "Notes",       key: "notes",        width: 28 },
  ];

  // Header row styling
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    cell.font = { bold: true, color: { argb: "FFA8FF3E" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FFA8FF3E" } },
    };
  });
  headerRow.height = 22;

  let totalIncome = 0;
  let totalExpenses = 0;

  rows.forEach((r) => {
    const amount = parseFloat(r.amount);
    const isIncome = r.type === "income";
    if (isIncome) totalIncome += amount;
    else totalExpenses += amount;

    const row = ws.addRow({
      id:          r.id,
      date:        r.date,
      type:        isIncome ? "Income" : "Expense",
      description: r.description,
      category:    r.categoryName,
      amount,
      notes:       r.notes ?? "",
    });

    // Alternate row background
    const bgColor = row.number % 2 === 0 ? "FFF5F5F5" : "FFFFFFFF";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    });

    // Type cell color
    const typeCell = row.getCell("type");
    typeCell.font = {
      bold: true,
      color: { argb: isIncome ? "FF16a34a" : "FFe11d48" },
    };
    typeCell.alignment = { horizontal: "center" };

    // Amount cell color
    const amountCell = row.getCell("amount");
    amountCell.numFmt = '"Q"#,##0.00';
    amountCell.font = {
      bold: true,
      color: { argb: isIncome ? "FF16a34a" : "FFe11d48" },
    };
    amountCell.alignment = { horizontal: "right" };

    row.height = 18;
  });

  // Totals row
  ws.addRow([]);
  const totalsRow = ws.addRow({
    id: "",
    date: "",
    type: "TOTALS",
    description: "",
    category: "",
    amount: "",
    notes: "",
  });

  const incomeCell = ws.addRow({
    id: "", date: "", type: "Total Income", description: "", category: "",
    amount: totalIncome, notes: "",
  });
  incomeCell.getCell("type").font = { bold: true, color: { argb: "FF16a34a" } };
  incomeCell.getCell("amount").numFmt = '"Q"#,##0.00';
  incomeCell.getCell("amount").font = { bold: true, color: { argb: "FF16a34a" } };
  incomeCell.getCell("amount").alignment = { horizontal: "right" };

  const expenseCell = ws.addRow({
    id: "", date: "", type: "Total Expenses", description: "", category: "",
    amount: totalExpenses, notes: "",
  });
  expenseCell.getCell("type").font = { bold: true, color: { argb: "FFe11d48" } };
  expenseCell.getCell("amount").numFmt = '"Q"#,##0.00';
  expenseCell.getCell("amount").font = { bold: true, color: { argb: "FFe11d48" } };
  expenseCell.getCell("amount").alignment = { horizontal: "right" };

  const balanceCell = ws.addRow({
    id: "", date: "", type: "Balance", description: "", category: "",
    amount: totalIncome - totalExpenses, notes: "",
  });
  const balance = totalIncome - totalExpenses;
  balanceCell.getCell("type").font = { bold: true };
  balanceCell.getCell("amount").numFmt = '"Q"#,##0.00';
  balanceCell.getCell("amount").font = { bold: true, color: { argb: balance >= 0 ? "FF16a34a" : "FFe11d48" } };
  balanceCell.getCell("amount").alignment = { horizontal: "right" };

  totalsRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    cell.font = { bold: true, color: { argb: "FFA8FF3E" } };
  });

  // ── Summary sheet ───────────────────────────────────────────────
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 20 },
    { header: "Value",  key: "value",  width: 16 },
  ];

  const summaryHeader = summary.getRow(1);
  summaryHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    cell.font = { bold: true, color: { argb: "FFA8FF3E" }, size: 11 };
    cell.alignment = { horizontal: "center" };
  });
  summaryHeader.height = 22;

  const summaryData = [
    { metric: "Total Transactions", value: rows.length },
    { metric: "Total Income",       value: totalIncome },
    { metric: "Total Expenses",     value: totalExpenses },
    { metric: "Balance",            value: totalIncome - totalExpenses },
  ];

  summaryData.forEach((d, i) => {
    const row = summary.addRow(d);
    const bgColor = i % 2 === 0 ? "FFF5F5F5" : "FFFFFFFF";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle" };
    });
    if (i > 0) {
      row.getCell("value").numFmt = '"Q"#,##0.00';
      const color = d.value >= 0 ? "FF16a34a" : "FFe11d48";
      row.getCell("value").font = { bold: true, color: { argb: color } };
    }
    row.height = 18;
  });

  // Send file
  res.setHeader("Content-Disposition", `attachment; filename="financeflow-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  await wb.xlsx.write(res);
  res.end();
});

export default router;
