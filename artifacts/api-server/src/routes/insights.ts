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

    const prompt = `You are a personal finance advisor. Analyze these transactions and provide insights in a friendly, clear way. Include:
1. Summary of spending by category
2. Top expense categories
3. Income sources analysis
4. 3-5 specific actionable recommendations to improve financial health
5. Overall financial health score (1-10)

IMPORTANT: The user's currency is ${currency} (${currencyLabel}). Always display amounts using the correct symbol and currency code — never convert to USD or any other currency.
Format your response compactly: keep each section brief, avoid large blank lines between items, and use tight bullet lists. No verbose padding.

Transactions:
${txText}

Keep it concise, friendly and actionable. Use emojis to make it engaging.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!geminiRes.ok) {
      return res.status(502).json({ error: "AI service error. Please try again." });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "No response from AI. Please try again." });
    }

    return res.json({ text });
  } catch {
    return res.status(500).json({ error: "Failed to analyze finances." });
  }
});

export default router;
