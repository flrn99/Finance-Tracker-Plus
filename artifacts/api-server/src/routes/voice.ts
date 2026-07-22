import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

// El audio llega como base64 en JSON (simple y sin dependencias de multipart).
// Límite generoso de body para clips de voz cortos.
router.post("/voice/parse", async (req, res) => {
  const userId = (req as any).userId;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Voice parsing is not configured." });

  const audioBase64 = req.body?.audio as string | undefined;
  const mimeType = (req.body?.mimeType as string | undefined) ?? "audio/webm";
  const currency = typeof req.body?.currency === "string" ? req.body.currency : "USD";
  if (!audioBase64) return res.status(400).json({ error: "No audio provided." });

  try {
    // Categorías reales del usuario — para que Gemini asigne una que existe
    const cats = await db
      .select({ id: categoriesTable.id, name: categoriesTable.name, type: categoriesTable.type })
      .from(categoriesTable)
      .where(eq(categoriesTable.userId, userId));

    const catList = cats.map((c) => `${c.name} (${c.type})`).join(", ") || "none";

    const prompt = `You are a financial assistant for a Guatemalan user. The audio is a person dictating a transaction, likely in Guatemalan Spanish (amounts may be said like "cincuenta quetzales", "un cincuenta", "ciento veinte").

Extract the transaction and respond with ONLY a raw JSON object (no markdown, no code fences, no extra text) with these exact keys:
{
  "amount": number,              // the numeric amount, no currency symbol
  "type": "expense" | "income",  // infer from context (gasté/pagué/compré = expense; recibí/me pagaron/gané = income). Default "expense" if unclear.
  "category": string,            // MUST be one of the user's categories below, matched by meaning. If nothing fits, use ""
  "description": string          // a short 2-4 word description of what it was for
}

The user's currency is ${currency}.
The user's available categories are: ${catList}.

If you cannot understand an amount, set "amount" to 0.
Respond with the JSON object only.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: audioBase64 } },
            ],
          }],
        }),
      },
    );

    if (!geminiRes.ok) return res.status(502).json({ error: "AI service error. Please try again." });

    const geminiData = await geminiRes.json() as any;
    let text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Could not understand the audio. Please try again." });

    // Limpiar posibles fences por si el modelo los agrega
    text = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Could not parse the transaction. Please try again." });
    }

    // Match de categoría contra las reales del usuario (case-insensitive)
    let categoryId: number | null = null;
    let categoryName: string | null = null;
    if (parsed.category) {
      const wanted = String(parsed.category).toLowerCase().trim();
      const match = cats.find((c) => c.name.toLowerCase() === wanted)
        ?? cats.find((c) => c.name.toLowerCase().includes(wanted) || wanted.includes(c.name.toLowerCase()));
      if (match) { categoryId = match.id; categoryName = match.name; }
    }

    return res.json({
      amount: typeof parsed.amount === "number" ? parsed.amount : 0,
      type: parsed.type === "income" ? "income" : "expense",
      categoryId,
      categoryName,
      description: typeof parsed.description === "string" ? parsed.description : "",
    });
  } catch {
    return res.status(500).json({ error: "Failed to process voice input." });
  }
});

export default router;
