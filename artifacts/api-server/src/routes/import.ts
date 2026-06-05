import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseTransactions(text: string) {
  const transactions: any[] = [];
  const lines = text.split("\n");
  
  for (const line of lines) {
    // Match pattern: day docNumber description amount (optional amount) balance
    const match = line.match(/^(\d{2})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})$/);
    if (!match) continue;

    const day = match[1];
    const description = match[3].trim();
    const col1 = parseFloat(match[4].replace(/,/g, ""));
    const col2 = match[5] ? parseFloat(match[5].replace(/,/g, "")) : null;

    // Determine if debit or credit based on column position
    // In Banco Industrial: col1 could be debit, col2 credit, or col1 credit
    let amount: number;
    let type: "income" | "expense";

    if (col2 !== null) {
      // Two amounts - first is debit, second is credit
      amount = col1;
      type = "expense";
    } else {
      // One amount - need context, default to expense
      amount = col1;
      type = "expense";
    }

    // Skip header rows and totals
    if (description.includes("SALDO") || description.includes("TOTAL") || description.includes("ULTIMA")) continue;

    transactions.push({
      day: parseInt(day),
      description,
      amount,
      type,
    });
  }

  return transactions;
}

router.post("/import/pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const userId = (req as any).userId;
    const data = await pdfParse(req.file.buffer);
    const text = data.text;

    // Get current year and month from text or use current date
    const yearMatch = text.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
    const monthMatch = text.match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\/(\d{2})/i);
    const months: Record<string, string> = {
      ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
      JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12"
    };
    const month = monthMatch ? months[monthMatch[1].toUpperCase()] : String(new Date().getMonth() + 1).padStart(2, "0");

    const rawTx = parseTransactions(text);

    // Return parsed transactions for user to review
    const transactions = rawTx.map(tx => ({
      date: `20${year.slice(-2)}-${month}-${String(tx.day).padStart(2, "0")}`,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
    }));

    res.json({ transactions, rawText: text.slice(0, 500) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
