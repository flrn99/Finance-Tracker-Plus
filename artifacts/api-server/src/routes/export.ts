import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import ExcelJS from "exceljs";
import path from "path";
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
  wb.creator = "Flow Finance";
  wb.created = new Date();

  const ws = wb.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
  });

  try {
    const logoId = wb.addImage({ filename: path.join(__dirname, "logo.png"), extension: "png" });
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 100 } });
  } catch {}

  ws.addRow([]);
  ws.addRow(["", "", "", "FLOW FINANCE"]);
  ws.addRow(["", "", "", `Financial Report — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`]);
  ws.addRow([]);

  ws.columns = [
    { key: "id",          width: 8  },
    { key: "date",        width: 14 },
    { key: "type",        width: 12 },
    { key: "description", width: 32 },
    { key: "category",    width: 20 },
    { key: "amount",      width: 14 },
    { key: "notes",       width: 28 },
  ];

  ws.getRow(2).getCell(4).font = { bold: true, size: 16, color: { argb: "FF1a1a2e" } };
  ws.getRow(3).getCell(4).font = { size: 11, color: { argb: "FF666666" } };

  const headerRow = ws.addRow(["ID", "Date", "Type", "Description", "Category", "Amount", "Notes"]);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {};
  });
  headerRow.height = 24;

  let totalIncome = 0;
  let totalExpenses = 0;

  rows.forEach((r) => {
    const amount = parseFloat(r.amount);
    const isIncome = r.type === "income";
    if (isIncome) totalIncome += amount;
    else totalExpenses += amount;

    const row = ws.addRow({
      id: r.id, date: r.date,
      type: isIncome ? "Income" : "Expense",
      description: r.description,
      category: r.categoryName,
      amount,
      notes: r.notes ?? "",
    });

    const bgColor = row.number % 2 === 0 ? "FFF7F7F7" : "FFFFFFFF";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle" };
      cell.border = {};
    });

    const typeCell = row.getCell("type");
    typeCell.font = { bold: true, color: { argb: isIncome ? "FF16a34a" : "FFe11d48" } };
    typeCell.alignment = { horizontal: "center" };

    const amountCell = row.getCell("amount");
    amountCell.numFmt = '"Q"#,##0.00';
    amountCell.font = { bold: true, color: { argb: isIncome ? "FF16a34a" : "FFe11d48" } };
    amountCell.alignment = { horizontal: "right" };

    row.height = 18;
  });

  ws.addRow([]);
  const totalsRow = ws.addRow({ id: "", date: "", type: "TOTALS", description: "", category: "", amount: "", notes: "" });
  totalsRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.border = {};
  });

  const incomeRow = ws.addRow({ id: "", date: "", type: "Total Income", description: "", category: "", amount: totalIncome, notes: "" });
  incomeRow.getCell("type").font = { bold: true, color: { argb: "FF16a34a" } };
  incomeRow.getCell("amount").numFmt = '"Q"#,##0.00';
  incomeRow.getCell("amount").font = { bold: true, color: { argb: "FF16a34a" } };
  incomeRow.getCell("amount").alignment = { horizontal: "right" };

  const expenseRow = ws.addRow({ id: "", date: "", type: "Total Expenses", description: "", category: "", amount: totalExpenses, notes: "" });
  expenseRow.getCell("type").font = { bold: true, color: { argb: "FFe11d48" } };
  expenseRow.getCell("amount").numFmt = '"Q"#,##0.00';
  expenseRow.getCell("amount").font = { bold: true, color: { argb: "FFe11d48" } };
  expenseRow.getCell("amount").alignment = { horizontal: "right" };

  const balance = totalIncome - totalExpenses;
  const balanceRow = ws.addRow({ id: "", date: "", type: "Balance", description: "", category: "", amount: balance, notes: "" });
  balanceRow.getCell("type").font = { bold: true };
  balanceRow.getCell("amount").numFmt = '"Q"#,##0.00';
  balanceRow.getCell("amount").font = { bold: true, color: { argb: balance >= 0 ? "FF16a34a" : "FFe11d48" } };
  balanceRow.getCell("amount").alignment = { horizontal: "right" };

  res.setHeader("Content-Disposition", `attachment; filename="flowfinance-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await wb.xlsx.write(res);
  res.end();
});

export default router;
