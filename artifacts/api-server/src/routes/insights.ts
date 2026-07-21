import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable, billsTable, billLogsTable } from "@workspace/db";
import { eq, and, desc, like } from "drizzle-orm";
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

// Fixed vs flexible: cruza las transacciones de gasto del mes contra bill_logs
// (que ya guarda transactionId cuando un Flow con auto-save generó la
// transacción real) — sin heurística de texto/monto, es el link real que ya
// existía en la DB para otra cosa (mostrar "pagado" en Goals). 100% aritmética,
// no necesita Gemini ni tocar la página "Analyze".
router.get("/insights/fixed-vs-flexible", async (req, res) => {
  const userId = (req as any).userId;
  const month = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);

  try {
    const txs = await db
      .select({ id: transactionsTable.id, amount: transactionsTable.amount })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "expense"),
          like(transactionsTable.date, `${month}%`),
        ),
      );

    if (txs.length === 0) {
      return res.json({ month, fixedTotal: 0, flexibleTotal: 0, total: 0 });
    }

    const fixedLinks = await db
      .select({ transactionId: billLogsTable.transactionId })
      .from(billLogsTable)
      .innerJoin(billsTable, eq(billLogsTable.billId, billsTable.id))
      .where(and(eq(billsTable.userId, userId), eq(billLogsTable.month, month), eq(billsTable.type, "expense")));

    const fixedIds = new Set(fixedLinks.map((f) => f.transactionId).filter((id): id is number => id !== null));

    let fixedTotal = 0;
    let total = 0;
    for (const t of txs) {
      const amt = parseFloat(t.amount);
      total += amt;
      if (fixedIds.has(t.id)) fixedTotal += amt;
    }

    return res.json({ month, fixedTotal, flexibleTotal: total - fixedTotal, total });
  } catch {
    return res.status(500).json({ error: "Failed to compute fixed vs flexible." });
  }
});

router.post("/insights/analyze", async (req, res) => {
  const userId = (req as any).userId;
  const currency = typeof req.body?.currency === "string" ? req.body.currency : "USD";
  const currencyLabel = CURRENCY_LABELS[currency] ?? currency;
  // La "biggest mover" ya la calcula el cliente (categoría vs su propio promedio
  // de 3 meses) — se le manda a Gemini como contexto para que escriba UNA sola
  // frase de interpretación anclada a ESE número real, en vez de que invente su
  // propio hallazgo que puede no coincidir con lo que ya se ve en pantalla.
  const anomaly = req.body?.anomaly && typeof req.body.anomaly === "object" ? req.body.anomaly : null;

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

    // Antes esto le pedía a Gemini 3 "findings" cortos que terminaban siendo
    // frases genéricas desconectadas del resto de la página. Ahora Gemini
    // recibe el mismo numero que ya se ve en pantalla (el "biggest mover" que
    // calcula el cliente) y su único trabajo es UNA frase de interpretación —
    // por qué puede estar pasando, o una tranquilidad honesta si no hay nada
    // raro — nunca repetir el dato.
    const anomalyContext = anomaly
      ? `The user's biggest spending mover this month: "${anomaly.categoryName}" is running ${Number(anomaly.multiplier).toFixed(1)}x its usual pace (${currency} ${anomaly.thisMonth} this month vs. a ${currency} ${anomaly.average} average).`
      : `Nothing moved unusually this month — every category stayed close to its own recent average.`;

    const prompt = `You are a personal finance advisor analyzing a user's transactions.

IMPORTANT: The user's currency is ${currency} (${currencyLabel}). Always display amounts using the correct symbol and currency code in "narrative" — never convert to USD or any other currency.

${anomalyContext}

Respond with:
- "note": exactly ONE short sentence of interpretation or context for the mover above — a plausible reason, a pattern worth watching, or (if nothing moved) an honest, reassuring line that it was a quiet, on-plan month. Never restate the number itself, the user already sees it. No filler, no "as shown above".
- "score": overall financial health score, 1-10, based on the full transaction history below.
- "narrative": a full markdown report — spending summary by category, top expense categories, income sources analysis, 3-5 specific actionable recommendations. Keep it compact: brief sections, no large blank lines, tight bullet lists, light emoji use.

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
                note: { type: "STRING" },
                narrative: { type: "STRING" },
              },
              required: ["score", "note", "narrative"],
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

    let parsed: { score: number; note: string; narrative: string };
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
