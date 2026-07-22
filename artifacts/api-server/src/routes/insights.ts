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

// Fixed vs flexible.
// "Fixed" es el monto configurado de TODOS los Flows de gasto activos, estén
// ya marcados como pagados este mes o no — el alquiler es un compromiso fijo
// aunque todavía no lo hayas tildado el día 1. Antes esto solo contaba Flows
// YA pagados (bill_logs.transactionId), así que alguien con Flows reales
// cargados pero sin marcar nada todavía este mes veía "Fixed" en 0 — parecía
// que la función no andaba.
// "Flexible" es el resto: gasto real de este mes que no es un Flow ya pagado
// (se excluye para no contarlo dos veces — ya está representado en "Fixed").
router.get("/insights/fixed-vs-flexible", async (req, res) => {
  const userId = (req as any).userId;
  const month = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);

  try {
    const activeBills = await db
      .select({ name: billsTable.name, amount: billsTable.amount, color: billsTable.color })
      .from(billsTable)
      .where(and(eq(billsTable.userId, userId), eq(billsTable.type, "expense")));

    const fixedTotal = activeBills.reduce((sum, b) => sum + (b.amount ? parseFloat(b.amount) : 0), 0);

    // El Flow individual más grande dentro de "Fixed" — antes esto vivía en
    // una card separada ("Biggest expense") que terminaba mostrando la misma
    // categoría que "Category on the move" casi siempre (si una categoría
    // salta mucho, fácilmente también es la más grande en $ ese mes). Acá
    // vive donde conceptualmente pertenece: es parte de lo que ya es fijo.
    let biggestFixedFlow: { name: string; amount: number; color: string | null } | null = null;
    for (const b of activeBills) {
      const amt = b.amount ? parseFloat(b.amount) : 0;
      if (amt <= 0) continue;
      if (!biggestFixedFlow || amt > biggestFixedFlow.amount) {
        biggestFixedFlow = { name: b.name, amount: amt, color: b.color };
      }
    }

    const paidLinks = await db
      .select({ transactionId: billLogsTable.transactionId })
      .from(billLogsTable)
      .innerJoin(billsTable, eq(billLogsTable.billId, billsTable.id))
      .where(and(eq(billsTable.userId, userId), eq(billLogsTable.month, month), eq(billsTable.type, "expense")));
    const paidIds = new Set(paidLinks.map((f) => f.transactionId).filter((id): id is number => id !== null));

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

    let flexibleTotal = 0;
    for (const t of txs) {
      if (paidIds.has(t.id)) continue; // ya representado en "Fixed"
      flexibleTotal += parseFloat(t.amount);
    }

    const total = fixedTotal + flexibleTotal;
    if (total === 0) return res.json({ month, fixedTotal: 0, flexibleTotal: 0, total: 0, biggestFixedFlow: null });
    return res.json({ month, fixedTotal, flexibleTotal, total, biggestFixedFlow });
  } catch {
    return res.status(500).json({ error: "Failed to compute fixed vs flexible." });
  }
});

// Biggest mover: la categoría con mayor cambio vs. su propio promedio histórico.
// Antes esto lo calculaba el cliente con hasta 8 fetches (mes actual + 3 pasados,
// cada uno con un fallback interno porque /categories/spending nunca existió como
// endpoint real) — todo en un solo round-trip acá.
router.get("/insights/anomaly", async (req, res) => {
  const userId = (req as any).userId;
  const month = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);

  try {
    const [baseYear, baseMonthNum] = month.split("-").map(Number);
    // Antes solo miraba 3 meses atrás — si el usuario no carga todos los meses
    // seguido (uso real, no diario), el historial comparable podía estar más
    // lejos y la categoría nunca aparecía como "en movimiento" aunque hubiera
    // data real para compararla. 6 meses atrás tolera huecos de uso.
    const monthKeys = [0, -1, -2, -3, -4, -5, -6].map((offset) => {
      const d = new Date(baseYear, baseMonthNum - 1 + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    const spendingByCategory = async (m: string) => {
      const rows = await db
        .select({ categoryName: categoriesTable.name, categoryColor: categoriesTable.color, amount: transactionsTable.amount })
        .from(transactionsTable)
        .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
        .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), like(transactionsTable.date, `${m}%`)));
      const grouped: Record<string, { total: number; color: string }> = {};
      for (const r of rows) {
        if (!grouped[r.categoryName]) grouped[r.categoryName] = { total: 0, color: r.categoryColor };
        grouped[r.categoryName].total += parseFloat(r.amount);
      }
      return grouped;
    };

    const [current, ...pastData] = await Promise.all(monthKeys.map(spendingByCategory));

    // Promedio solo sobre los meses que tuvieron gasto real en esa categoría —
    // dividir siempre entre 3 dejaba el promedio artificialmente bajo en cuentas
    // sin 3 meses completos de historial.
    const history: Record<string, { sum: number; count: number }> = {};
    for (const monthData of pastData) {
      for (const [name, v] of Object.entries(monthData)) {
        if (!history[name]) history[name] = { sum: 0, count: 0 };
        history[name].sum += v.total;
        history[name].count += 1;
      }
    }

    let mover: { categoryName: string; categoryColor: string; thisMonth: number; average: number; multiplier: number } | null = null;
    for (const [name, v] of Object.entries(current)) {
      const hist = history[name];
      if (!hist || hist.count === 0) continue;
      const average = hist.sum / hist.count;
      if (average < 5) continue;
      const multiplier = v.total / average;
      if (!mover || multiplier > mover.multiplier) {
        mover = { categoryName: name, categoryColor: v.color, thisMonth: v.total, average, multiplier };
      }
    }
    // Ya no hay fallback acá a "categoría más grande como si fuera mover 1.0x"
    // — eso confundía tamaño con cambio.
    // "Biggest expense" como card aparte se sacó: terminaba mostrando la misma
    // categoría que mover casi siempre (si el salto es grande, fácilmente
    // también es la más grande en $ ese mes) — esa info ahora vive dentro de
    // "Fixed vs flexible" (el Flow más grande dentro de "Fixed").
    return res.json({ mover });
  } catch {
    return res.status(500).json({ error: "Failed to compute anomaly." });
  }
});

// Income summary: consistencia de ingreso (este mes vs. promedio de meses con
// ingreso real) + savings rate (cuánto de lo ganado este mes quedó después del
// gasto real). Ambos vienen del mismo lugar porque comparten el mismo gasto
// real del mes — "Fixed vs flexible" usa el monto CONFIGURADO de los Flows
// (compromiso, no necesariamente ya pagado), acá se necesita el gasto REAL
// transaccionado para que el savings rate sea correcto.
router.get("/insights/income-summary", async (req, res) => {
  const userId = (req as any).userId;
  const month = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);

  try {
    const [baseYear, baseMonthNum] = month.split("-").map(Number);
    // Mismo criterio que /insights/anomaly: 6 meses atrás en vez de 3, para
    // tolerar huecos de uso real en vez de exigir carga mes a mes.
    const monthKeys = [0, -1, -2, -3, -4, -5, -6].map((offset) => {
      const d = new Date(baseYear, baseMonthNum - 1 + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    const totalByType = async (m: string, type: "income" | "expense") => {
      const rows = await db
        .select({ amount: transactionsTable.amount })
        .from(transactionsTable)
        .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, type), like(transactionsTable.date, `${m}%`)));
      return rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    };

    const [thisMonthIncome, ...pastIncomes] = await Promise.all(monthKeys.map((m) => totalByType(m, "income")));
    const thisMonthExpense = await totalByType(monthKeys[0], "expense");

    // Mismo criterio que "biggest mover": promediar solo sobre meses que
    // tuvieron ingreso real, no dividir siempre entre 3 (eso arrastraba el
    // promedio artificialmente bajo en cuentas sin 3 meses de historial).
    const pastWithData = pastIncomes.filter((v) => v > 0);
    const average = pastWithData.length > 0 ? pastWithData.reduce((a, b) => a + b, 0) / pastWithData.length : 0;

    const income = thisMonthIncome > 0
      ? {
          thisMonth: thisMonthIncome,
          average,
          delta: average > 0 ? ((thisMonthIncome - average) / average) * 100 : 0,
          hasHistory: average > 0,
        }
      : null;

    const savingsRate = thisMonthIncome > 0
      ? {
          rate: ((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100,
          income: thisMonthIncome,
          expense: thisMonthExpense,
          saved: thisMonthIncome - thisMonthExpense,
        }
      : null;

    return res.json({ income, savingsRate });
  } catch {
    return res.status(500).json({ error: "Failed to compute income summary." });
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
- "narrative": a full, substantive markdown report, AT LEAST 300 words — this is the one place in the whole response where you have real room, use it. Structure: ## 📊 Spending summary (by category, with real amounts), ## 💸 Top expense categories (ranked, with amounts and % of total), ## 💰 Income sources (breakdown + consistency), ## ✅ Recommendations (3-5 specific, actionable, tied to real numbers from the data — not generic advice like "save more"). One relevant emoji per heading, nowhere else in the body — it's a visual anchor, not decoration sprinkled everywhere. Bold (**) the single most important number or takeaway in every section so it doesn't read as one flat wall of text. Compact formatting (tight bullets, no huge blank gaps) is about whitespace, not about cutting content short — depth and specificity matter more than brevity here.

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

    const geminiData = await geminiRes.json() as any;
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
