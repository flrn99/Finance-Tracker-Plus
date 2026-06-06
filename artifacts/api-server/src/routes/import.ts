import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import multer from "multer";
import PDFParser from "pdf2json";

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function extractTransactions(pdfData: any, year: string, month: string) {
  const transactions: any[] = [];
  
  const pages = pdfData.Pages || [];
  let allText = "";
  
  for (const page of pages) {
    const texts = page.Texts || [];
    const lineMap: Record<number, string[]> = {};
    
    for (const text of texts) {
      const y = Math.round(text.y * 10);
      if (!lineMap[y]) lineMap[y] = [];
      const str = text.R?.map((r: any) => decodeURIComponent(r.T)).join("") || "";
      lineMap[y].push(str);
    }
    
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => a - b);
    for (const y of sortedYs) {
      allText += lineMap[y].join(" ") + "\n";
    }
  }

  const lines = allText.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("SALDO ANTERIOR") || trimmed.includes("ULTIMA LINEA") || trimmed.includes("Totales") || trimmed.includes("****")) continue;

    const match = trimmed.match(/^(\d{2})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?(?:\s+([\d,]+\.\d{2}))?/);
    if (!match) continue;

    const day = match[1];
    const description = match[3].trim();
    const num1 = parseFloat(match[4].replace(/,/g, ""));
    const num2 = match[5] ? parseFloat(match[5].replace(/,/g, "")) : null;
    const num3 = match[6] ? parseFloat(match[6].replace(/,/g, "")) : null;

    let amount: number;
    let type: "income" | "expense";

    // In BI statements: debit, credit, balance OR debit, balance OR credit, balance
    if (num2 !== null && num3 !== null) {
      // Three numbers: first is debit or credit, second is the other, third is balance
      // Determine by checking if description has credit keywords
      const isCredit = description.match(/CREDITO|ACH|PAGO|DEV|NOTA CREDITO/i);
      if (isCredit) {
        amount = num2 > 0 && num2 !== num3 ? num2 : num1;
        type = "income";
      } else {
        amount = num1;
        type = "expense";
      }
    } else if (num2 !== null) {
      amount = num1;
      type = "expense";
    } else {
      amount = num1;
      type = "expense";
    }

    const isCredit = description.match(/NOTA CREDITO|ACH .+? A$|DEV /i);
    if (isCredit) type = "income";

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

    const pdfParser = new (PDFParser as any)(null, 1);
    
    const pdfData = await new Promise<any>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (err: any) => reject(new Error(err.parserError)));
      pdfParser.on("pdfParser_dataReady", (data: any) => resolve(data));
      pdfParser.parseBuffer(req.file!.buffer);
    });

    const rawText = pdfParser.getRawTextContent();
    
    // Detect month/year
    const monthMap: Record<string, string> = {
      ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
      JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12"
    };

    const monthMatch = rawText.match(/(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\/(\d{2})/i);
    const month = monthMatch ? monthMap[monthMatch[1].toUpperCase()] : String(new Date().getMonth() + 1).padStart(2, "0");
    const yearSuffix = monthMatch ? monthMatch[2] : String(new Date().getFullYear()).slice(-2);
    const year = `20${yearSuffix}`;

    const transactions = extractTransactions(pdfData, year, month);

    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;