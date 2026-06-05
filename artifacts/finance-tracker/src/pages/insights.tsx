import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Sparkles, Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function Insights() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeFinances = async () => {
    setIsAnalyzing(true);
    setError(null);
    setInsights(null);
    try {
      const res = await fetch(getApiUrl("/api/transactions"), {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      const transactions = data.data || data;

      if (!transactions || transactions.length === 0) {
        setError("No transactions found to analyze.");
        return;
      }

      const txText = transactions.map((t: any) =>
        `${t.date} | ${t.type} | ${t.amount} | ${t.description} | ${t.categoryName || t.category?.name || "Unknown"}`
      ).join("\n");

      const prompt = `You are a personal finance advisor. Analyze these transactions and provide insights in a friendly, clear way. Include:
1. Summary of spending by category
2. Top expense categories
3. Income sources analysis
4. 3-5 specific actionable recommendations to improve financial health
5. Overall financial health score (1-10)

Transactions:
${txText}

Keep it concise, friendly and actionable. Use emojis to make it engaging.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const geminiData = await response.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");
      setInsights(text);
    } catch (e: any) {
      setError(e.message || "Failed to analyze finances");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const importPDF = async (base64: string) => {
    setIsImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const prompt = `Extract ALL transactions from this bank statement PDF. Return ONLY a JSON array with no extra text, like this:
[
  {"date": "2026-05-03", "description": "NOTA DEBITO MEMBRESIA", "amount": 15.00, "type": "expense"},
  {"date": "2026-05-04", "description": "ACH WALTER EDUARDO", "amount": 900.00, "type": "income"}
]
Rules:
- Debits = expense, Credits = income
- date format: YYYY-MM-DD
- amount: positive number always
- Include ALL transactions, skip SALDO ANTERIOR and ULTIMA LINEA
- Return ONLY the JSON array, no markdown, no explanation`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: "application/pdf", data: base64 } },
                { text: prompt }
              ]
            }],
          }),
        }
      );

      const geminiData = await response.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");

      const clean = text.replace(/```json|```/g, "").trim();
      const transactions = JSON.parse(clean);
      setImportResult(transactions);
    } catch (e: any) {
      setError(e.message || "Failed to import PDF");
    } finally {
      setIsImporting(false);
    }
  };

  const handleUpload = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FilePicker.pickFiles({ types: ["application/pdf"], readData: true, limit: 1 });
        const file = result.files[0];
        if (file?.data) {
          await importPDF(file.data);
        } else {
          setError("Could not read file data");
        }
      } else {
        document.getElementById("pdf-input")?.click();
      }
    } catch (e: any) {
      if (!e.message?.includes("cancel") && !e.message?.includes("Cancel")) {
        setError("Failed to pick file: " + e.message);
      }
    }
  };

  const confirmImport = async () => {
    if (!importResult) return;
    setIsImporting(true);
    try {
      const catRes = await fetch(getApiUrl("/api/categories"), {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const catData = await catRes.json();
      const categories = catData.data || catData;
      const defaultExpenseCat = categories.find((c: any) => c.type === "expense")?.id;
      const defaultIncomeCat = categories.find((c: any) => c.type === "income")?.id;

      let success = 0;
      for (const tx of importResult) {
        const categoryId = tx.type === "income" ? defaultIncomeCat : defaultExpenseCat;
        if (!categoryId) continue;
        const res = await fetch(getApiUrl("/api/transactions"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            date: tx.date,
            categoryId,
            notes: "Imported from bank statement",
          }),
        });
        if (res.ok) success++;
      }
      setImportResult(null);
      setError(null);
      alert(`✅ ${success} transactions imported successfully!`);
    } catch (e: any) {
      setError(e.message || "Failed to save transactions");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-lg">
      <div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Insights</h2>
        <p className="text-muted-foreground mt-1 text-sm">AI-powered analysis of your finances.</p>
      </div>

      {/* Import PDF */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-sidebar-primary" />
          <p className="font-bold text-sm">Import Bank Statement</p>
        </div>
        <p className="text-xs text-muted-foreground">Upload your bank statement PDF and we'll extract all transactions automatically.</p>
        <button
          onClick={handleUpload}
          disabled={isImporting}
          className="w-full py-3 rounded-xl bg-[#A8FF3E] text-black text-sm font-bold transition-all border-0 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isImporting ? "Reading PDF..." : "Upload PDF"}
        </button>
        <input
          id="pdf-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            await importPDF(base64);
          }}
        />
      </div>

      {/* Import preview */}
      {importResult && (
        <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
          <p className="font-bold text-sm">Found {importResult.length} transactions</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {importResult.slice(0, 10).map((tx, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tx.description}</p>
                  <p className="text-muted-foreground">{tx.date}</p>
                </div>
                <span className={cn("font-bold ml-2", tx.type === "income" ? "text-income" : "text-expense")}>
                  {tx.type === "income" ? "+" : "-"}{tx.amount}
                </span>
              </div>
            ))}
            {importResult.length > 10 && (
              <p className="text-xs text-muted-foreground text-center">+{importResult.length - 10} more</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={confirmImport}
              disabled={isImporting}
              className="flex-1 py-2.5 rounded-xl bg-[#A8FF3E] text-black text-sm font-bold hover:bg-[#9bfe32] transition-all border-0"
            >
              {isImporting ? "Importing..." : "Import All"}
            </button>
            <button
              onClick={() => setImportResult(null)}
              className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-all border-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI Analysis */}
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sidebar-primary" />
          <p className="font-bold text-sm">AI Financial Analysis</p>
        </div>
        <p className="text-xs text-muted-foreground">Get personalized insights and recommendations based on your transactions.</p>
        <button
          onClick={analyzeFinances}
          disabled={isAnalyzing}
          className="w-full py-3 rounded-xl bg-[#A8FF3E] text-black text-sm font-bold hover:bg-[#9bfe32] transition-all disabled:opacity-60 border-0 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isAnalyzing ? "Analyzing..." : "Analyze my finances"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Insights result */}
      {insights && (
        <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sidebar-primary" />
            <p className="font-bold text-sm">Your Financial Report</p>
          </div>
          <div className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
