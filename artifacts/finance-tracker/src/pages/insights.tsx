import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Sparkles, Upload, FileText, Loader2, AlertCircle, ChevronDown, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

interface EditableTx {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId: number | null;
  selected: boolean;
}

export default function Insights() {
  const { session } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [editableTxs, setEditableTxs] = useState<EditableTx[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch(getApiUrl("/api/categories"), {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.json())
      .then(d => setCategories(d.data || d))
      .catch(() => {});
  }, [session]);

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

  const handleUpload = async () => {
    try {
      setError(null);
      let blob: Blob;
      let filename = "statement.pdf";

      if (Capacitor.isNativePlatform()) {
        const result = await FilePicker.pickFiles({ types: ["application/pdf"], readData: true, limit: 1 });
        const file = result.files[0];
        if (!file?.data) { setError("Could not read file"); return; }
        const byteChars = atob(file.data);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        blob = new Blob([byteArr], { type: "application/pdf" });
        filename = file.name || filename;
      } else {
        return;
      }

      setIsImporting(true);
      const formData = new FormData();
      formData.append("pdf", blob, filename);

      const res = await fetch(getApiUrl("/api/import/pdf"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      // Get default categories
      const expenseCat = categories.find(c => c.type === "expense");
      const incomeCat = categories.find(c => c.type === "income");

      const txs: EditableTx[] = data.transactions.map((tx: any) => ({
        ...tx,
        categoryId: tx.type === "income" ? (incomeCat?.id || null) : (expenseCat?.id || null),
        selected: true,
      }));

      setEditableTxs(txs);
    } catch (e: any) {
      if (!e.message?.includes("cancel")) setError("Failed: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const updateTx = (i: number, field: keyof EditableTx, value: any) => {
    setEditableTxs(prev => {
      if (!prev) return prev;
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  };

  const saveTransactions = async () => {
    if (!editableTxs) return;
    setIsSaving(true);
    try {
      const toImport = editableTxs.filter(tx => tx.selected && tx.categoryId);
      let success = 0;
      for (const tx of toImport) {
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
            categoryId: tx.categoryId,
            notes: "Imported from bank statement",
          }),
        });
        if (res.ok) success++;
      }
      setEditableTxs(null);
      setError(null);
      alert(`✅ ${success} transactions imported!`);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-lg">
      <div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Insights</h2>
        <p className="text-muted-foreground mt-1 text-sm">AI-powered analysis of your finances.</p>
      </div>

      {/* Import PDF */}
      {!editableTxs && (
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
        </div>
      )}

      {/* Review transactions */}
      {editableTxs && (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="font-bold text-sm">Review {editableTxs.length} transactions</p>
            <button onClick={() => setEditableTxs(null)} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {editableTxs.map((tx, i) => (
              <div key={i} className={cn("p-4 space-y-3", !tx.selected && "opacity-50")}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateTx(i, "selected", !tx.selected)}
                    className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                      tx.selected ? "bg-[#A8FF3E] border-[#A8FF3E]" : "border-border"
                    )}
                  >
                    {tx.selected && <Check className="h-3 w-3 text-black" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={tx.description}
                      onChange={e => updateTx(i, "description", e.target.value)}
                      className="w-full text-sm font-medium bg-transparent border-none outline-none text-foreground"
                    />
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-sm font-bold", tx.type === "income" ? "text-income" : "text-expense")}>
                      {tx.type === "income" ? "+" : "-"}{tx.amount}
                    </p>
                    <button
                      onClick={() => updateTx(i, "type", tx.type === "income" ? "expense" : "income")}
                      className="text-xs text-muted-foreground underline"
                    >
                      {tx.type}
                    </button>
                  </div>
                </div>

                <select
                  value={tx.categoryId ?? ""}
                  onChange={e => updateTx(i, "categoryId", Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none"
                >
                  <option value="">Select category...</option>
                  {categories
                    .filter(c => c.type === tx.type)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-border flex gap-2">
            <button
              onClick={saveTransactions}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-[#A8FF3E] text-black text-sm font-bold hover:bg-[#9bfe32] transition-all border-0 disabled:opacity-60"
            >
              {isSaving ? "Importing..." : `Import ${editableTxs.filter(t => t.selected).length} selected`}
            </button>
            <button
              onClick={() => setEditableTxs(null)}
              className="px-4 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold border-0"
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
