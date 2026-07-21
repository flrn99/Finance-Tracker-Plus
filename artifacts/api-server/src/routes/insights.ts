import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.use(authMiddleware);

// Etiquetas de moneda — espejo del CURRENCY_INFO del frontend
const CURRENCY_LABELS: Record<string, string> = {
  GTQ: "Guatemalan Quetzal",
  USD: "US Dollar",
  EUR: "Euro",
  MXN: "Mexican Peso",
  COP: "Colombian Peso",
  ARS: "Argentine Peso",
  CLP: "Chilean Peso",
  PEN: "Peruvian Sol",
  BRL: "Brazilian Real",
  GBP: "British Pound",
};

router.post("/insights/analyze", async (req, res) => {
  const userId = (req as any).userId;
  const currency = typeof req.body?.currency === "string" ? req.body.currency : "USD";
  const currencyLabel = CURRENCY_LABELS[currency] ?? currency;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI analysis is not configured." });
  }

  try {
    // Las transacciones se leen del servidor con el userId del token —
    // el cliente nunca las envía, van directo de la DB a Gemini.
    const rows = await db
      .select({
        date: transactionsTable.date,
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        description: transactionsTable.description,
        categoryName: categoriesTable.name,
      })
      .from(transactionsTable)
      .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.date));

    if (rows.length === 0) {
      return res.status(400).json({ error: "No transactions found to analyze." });
    }

    const txText = rows
      .map((t) => `${t.date} | ${t.type} | ${t.amount} | ${t.description} | ${t.categoryName ?? "Unknown"}`)
      .join("\n");

    // Antes esto devolvía un solo bloque de texto libre y el frontend le
    // arrancaba 1-2 oraciones con una regex para el "Quick take" — resultaba
    // en fragmentos random, a veces vagos, a veces ausentes si Gemini no
    // tocaba ese tema. Pidiendo JSON estructurado con "findings" fijos (3,
    // siempre, con tipo real) el frontend ya no adivina nada.
    const prompt = `You are a personal finance advisor analyzing a user's transactions.

IMPORTANT: The user's currency is ${currency} (${currencyLabel}). Always display amounts using the correct symbol and currency code in "narrative" — never convert to USD or any other currency.

Respond with findings and a narrative report about the transactions below.

Rules for "findings":
- Always exactly 3, never fewer, never omitted.
- Each "text" must stand on its own — no "as shown above", no filler, no vague generalities. Name real categories and amounts from the data.
- Vary the type across the 3 when the data supports it, but pick whatever is true — don't force one of each if it's not honest.
- If nothing negative or surprising happened, still fill that slot honestly and reassuringly (e.g. "No category spiked unusually this month — spending stayed steady across the board") instead of skipping it or inventing a problem.

Rules for "narrative": a full markdown report — spending summary by category, top expense categories, income sources analysis, 3-5 specific actionable recommendations. Keep it compact: brief sections, no large blank lines, tight bullet lists, light emoji use.

Transactions:
${txText}`;

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
              type: "OBJECT",
              properties: {
                score: { type: "NUMBER", description: "Overall financial health score, 1-10" },
                findings: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING", enum: ["warning", "positive", "tip"] },
                      text: { type: "STRING" },
                    },
                    required: ["type", "text"],
                  },
                },
                narrative: { type: "STRING" },
              },
              required: ["score", "findings", "narrative"],
            },
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      return res.status(502).json({ error: "AI service error. Please try again." });
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
      return res.status(502).json({ error: "No response from AI. Please try again." });
    }

    let parsed: { score: number; findings: { type: string; text: string }[]; narrative: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "AI returned an unexpected format. Please try again." });
    }

    return res.json(parsed);
  } catch {
    return res.status(500).json({ error: "Failed to analyze finances." });
  }
});

export default router;
