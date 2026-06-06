import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import multer from "multer";

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseTransactions(text: string, year: string, month: string) {
  const transactions: any[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("SALDO ANTERIOR") || trimmed.includes("ULTIMA LINEA") || trimmed.includes("Totales")) continue;

    // Match: day docNum description debit/credit balance
    const match = trimmed.match(/^(\d{2})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s*([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?$/);
    if (!match) continue;

    const day = match[1];
    const description = match[3].trim();
    const amount1 = parseFloat(match[4].replace(/,/g, ""));
    const amount2 = match[5] ? parseFloat(match[5].replace(/,/g, "")) : null;
    const amount3 = match[6] ? parseFloat(match[6].replace(/,/g, "")) : null;

    let amount: number;
    let type: "income" | "expense";

    if (amount2 !== null && amount3 !== null) {
      // Has debit and credit columns
      amount = amount1;
      type = "expense";
    } else if (amount2 !== null) {
      // Could be credit
      amount = amount2;
      type = "income";
    } else {
      amount = amount1;
      type = "expense";
    }

    transactions.push({
      date: `${year}-${month}-${String(day).padStart(2, "0")}`,
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

    // Use pdfjs-dist to extract text
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(req.file.buffer) });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    // Detect year and month
    const monthMap: Record<string, string> = {
      ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
      JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12"
    };

    const monthMatch = fullText.match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\/(\d{2})/i);
    const month = monthMatch ? monthMap[monthMatch[1].toUpperCase()] : String(new Date().getMonth() + 1).padStart(2, "0");
    const yearSuffix = monthMatch ? monthMatch[2] : String(new Date().getFullYear()).slice(-2);
    const year = `20${yearSuffix}`;

    const transactions = parseTransactions(fullText, year, month);

    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
