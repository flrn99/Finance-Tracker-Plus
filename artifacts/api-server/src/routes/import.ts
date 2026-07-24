import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import multer from "multer";
import PDFParser from "pdf2json";
import * as XLSX from "xlsx";
import { db, categoriesTable, transactionsTable } from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const MAX_IMPORT_ROWS = 3000;

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
      const str = text.R?.map((r: any) => { try { return decodeURIComponent(r.T); } catch { return r.T; } }).join("") || "";
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

    return res.json({ transactions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/import/excel/parse", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ error: "No sheets found in file" });

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" }) as unknown[][];
    if (rows.length === 0) return res.status(400).json({ error: "File is empty" });

    const [headerRow, ...dataRows] = rows;
    if (dataRows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `File has too many rows (max ${MAX_IMPORT_ROWS})` });
    }

    return res.json({
      headers: (headerRow ?? []).map((h) => String(h ?? "").trim()),
      rows: dataRows.map((r) => r.map((c) => String(c ?? "").trim())),
      rowCount: dataRows.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to parse file" });
  }
});

interface CategorizeRow {
  index: number;
  date: string;
  amount: number;
  type: "expense" | "income";
  description: string;
}

// Une categorización (Gemini, en bulk) y detección de duplicados en una sola
// llamada — evita un tercer round-trip para un flujo que ya tiene bastantes.
router.post("/import/excel/categorize", async (req, res) => {
  const userId = (req as any).userId;
  const rows = req.body?.rows as CategorizeRow[] | undefined;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No rows provided" });
  if (rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ error: `Too many rows (max ${MAX_IMPORT_ROWS})` });
  }

  try {
    const cats = await db
      .select({ id: categoriesTable.id, name: categoriesTable.name, type: categoriesTable.type })
      .from(categoriesTable)
      .where(eq(categoriesTable.userId, userId));

    const dates = rows.map((r) => r.date).filter(Boolean).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const existing = minDate && maxDate
      ? await db
          .select({
            id: transactionsTable.id,
            date: transactionsTable.date,
            amount: transactionsTable.amount,
            description: transactionsTable.description,
          })
          .from(transactionsTable)
          .where(and(
            eq(transactionsTable.userId, userId),
            gte(transactionsTable.date, minDate),
            lte(transactionsTable.date, maxDate),
          ))
      : [];

    const findDuplicate = (row: CategorizeRow) => {
      const wanted = row.description.toLowerCase().trim();
      return existing.find((tx) => {
        if (tx.date !== row.date) return false;
        if (Math.abs(parseFloat(tx.amount) - row.amount) > 0.005) return false;
        const txDesc = tx.description.toLowerCase().trim();
        return txDesc === wanted || txDesc.includes(wanted) || wanted.includes(txDesc);
      });
    };

    // Sugerencias de categoría vía Gemini — UNA llamada bulk (chunkeada de a
    // 300 filas en paralelo solo para no arriesgar el límite de tokens de
    // salida en archivos grandes, nunca fila por fila). Si Gemini no está
    // configurado o falla, no bloquea el import: el usuario categoriza a
    // mano en la preview, igual que corrige cualquier sugerencia.
    const apiKey = process.env.GEMINI_API_KEY;
    const suggestions = new Map<number, string>();

    if (apiKey && cats.length > 0) {
      const catList = cats.map((c) => `${c.name} (${c.type})`).join(", ");
      const chunkSize = 300;
      const chunks: CategorizeRow[][] = [];
      for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));

      await Promise.all(chunks.map(async (chunk) => {
        const itemsText = chunk.map((r) => `${r.index}: "${r.description}" (${r.type})`).join("\n");
        const prompt = `You are categorizing personal finance transactions imported from a spreadsheet.

The user's available categories are: ${catList}.

For each transaction below, pick the category name that best matches its description and type. Use ONLY category names from the list above, matched by meaning — if nothing fits well, use an empty string.

Transactions:
${itemsText}`;

        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        index: { type: "NUMBER" },
                        categoryName: { type: "STRING" },
                      },
                      required: ["index", "categoryName"],
                    },
                  },
                },
              }),
            },
          );
          if (!geminiRes.ok) return;
          const geminiData = await geminiRes.json() as any;
          const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!raw) return;
          const parsed = JSON.parse(raw) as { index: number; categoryName: string }[];
          for (const item of parsed) {
            if (item.categoryName) suggestions.set(item.index, item.categoryName);
          }
        } catch {
          // Este chunk queda sin sugerencia — el resto sigue su curso.
        }
      }));
    }

    const results = rows.map((row) => {
      const suggested = suggestions.get(row.index);
      let categoryId: number | null = null;
      let categoryName: string | null = null;
      if (suggested) {
        const wanted = suggested.toLowerCase().trim();
        const match = cats.find((c) => c.name.toLowerCase() === wanted)
          ?? cats.find((c) => c.name.toLowerCase().includes(wanted) || wanted.includes(c.name.toLowerCase()));
        if (match) { categoryId = match.id; categoryName = match.name; }
      }

      const dup = findDuplicate(row);

      return {
        index: row.index,
        categoryId,
        categoryName,
        isDuplicate: !!dup,
        duplicateOf: dup
          ? { id: dup.id, date: dup.date, amount: parseFloat(dup.amount), description: dup.description }
          : undefined,
      };
    });

    return res.json({ results });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to categorize transactions" });
  }
});

export default router;