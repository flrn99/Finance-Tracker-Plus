import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Sparkles, Upload, Loader2, AlertCircle, X, TrendingDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCurrency, CURRENCY_INFO } from "@/lib/currency-context";
import { getApiUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import ImportReview from "@/components/import-review";
import { useToast } from "@/hooks/use-toast";

// La API key de Gemini vive en el backend — ya NO se hornea en el APK

const ACCENT = "#0EA5E9";

interface EditableTx {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId: number | null;
  selected: boolean;
}

interface TopCategory {
  categoryName: string;
  categoryColor: string;
  total: number;
  count: number;
}

interface LastAnalysis {
  date: string;
  score: string | null;
}

function InsightsModal({ insights, onClose }: { insights: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex flex-col justify-end"
      style={{ zIndex: 9999, backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >

      <div
        className="bg-background rounded-t-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ maxHeight: "calc(100vh - env(safe-area-inset-top) - 40px)" }}
        onClick={e => e.stopPropagation()}
      >

        <div className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background: ACCENT }}>
          <Sparkles className="h-4 w-4 text-black" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Your Financial Report</p>
            <p className="text-xs font-light text-muted-foreground">Powered by Gemini</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}>
          <div className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert
            prose-headings:font-bold prose-headings:text-foreground prose-headings:mb-1 prose-headings:mt-3
            prose-p:text-muted-foreground prose-p:text-sm prose-p:my-1
            prose-strong:text-foreground prose-strong:font-semibold
            prose-li:text-muted-foreground prose-li:text-sm prose-li:my-0
            prose-ul:my-1 prose-ol:my-1">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Insights() {
  const { session } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [analyzePhase, setAnalyzePhase] = useState("");
  const [insights, setInsights] = useState<string | null>(null);
  const [editableTxs, setEditableTxs] = useState<EditableTx[] | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<LastAnalysis | null>(() => {
    try {
      const saved = localStorage.getItem("ff-last-analysis");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch(getApiUrl("/api/categories"), {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.json())
      .then(d => setCategories(d.data || d))
      .catch(() => {});

    // Fetch spending by category for current month
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    fetch(getApiUrl(`/api/categories/spending?type=expense&month=${month}`), {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        const data = d.data || d;
        if (Array.isArray(data) && data.length > 0) {
          setTopCategories(data.slice(0, 3).map((c: any) => ({
            categoryName: c.categoryName || c.name,
            categoryColor: c.categoryColor || c.color,
            total: c.total || c.amount,
            count: c.count || c.transactionCount || 1,
          })));
        }
      })
      .catch(() => {
        // fallback: use transactions endpoint directly
        fetch(getApiUrl(`/api/transactions?month=${month}`), {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
          .then(r => r.json())
          .then(d => {
            const txs = d.data || d;
            if (!Array.isArray(txs)) return;
            const expenses = txs.filter((t: any) => t.type === "expense");
            const grouped: Record<string, any> = {};
            for (const tx of expenses) {
              const key = tx.categoryId || tx.category?.id || "unknown";
              if (!grouped[key]) {
                grouped[key] = {
                  categoryName: tx.categoryName || tx.category?.name || "Other",
                  categoryColor: tx.categoryColor || tx.category?.color || "#888",
                  total: 0,
                  count: 0,
                };
              }
              grouped[key].total += tx.amount;
              grouped[key].count += 1;
            }
            const sorted = Object.values(grouped)
              .sort((a: any, b: any) => b.total - a.total)
              .slice(0, 3);
            setTopCategories(sorted);
          })
          .catch(() => {});
      });
  }, [session]);

  // Extract score from insights text
  const extractScore = (text: string): string | null => {
    const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
    return match ? match[1] : null;
  };

  const analyzeFinances = async () => {
    setIsAnalyzing(true);
    setError(null);
    setInsights(null);
    try {
      setAnalyzePhase("Analyzing your finances...");
      const response = await fetch(getApiUrl("/api/insights/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ currency }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result?.error || "Failed to analyze finances");
        return;
      }
      const text = result.text;
      if (!text) throw new Error("No response from AI");

      // Save last analysis to localStorage
      const analysis: LastAnalysis = {
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        score: extractScore(text),
      };
      setLastAnalysis(analysis);
      try { localStorage.setItem("ff-last-analysis", JSON.stringify(analysis)); } catch {}

      setInsights(text);
    } catch (e: any) {
      setError(e.message || "Failed to analyze finances");
    } finally {
      setIsAnalyzing(false);
      setAnalyzePhase("");
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
      setImportProgress(0);

      const formData = new FormData();
      formData.append("pdf", blob, filename);

      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", getApiUrl("/api/import/pdf"));
        xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setImportProgress(Math.round((e.loaded / e.total) * 60));
        };

        let serverProgress = 60;
        const serverInterval = setInterval(() => {
          serverProgress += 2;
          if (serverProgress >= 95) { clearInterval(serverInterval); serverProgress = 95; }
          setImportProgress(serverProgress);
        }, 400);

        xhr.onload = () => {
          clearInterval(serverInterval);
          setImportProgress(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch { reject(new Error("Invalid response")); }
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error || "Import failed")); }
            catch { reject(new Error("Import failed")); }
          }
        };
        xhr.onerror = () => { clearInterval(serverInterval); reject(new Error("Network error")); };
        xhr.send(formData);
      });

      const txs: EditableTx[] = data.transactions.map((tx: any) => ({
        ...tx, categoryId: null, selected: true,
      }));
      setEditableTxs(txs);
    } catch (e: any) {
      if (!e.message?.includes("cancel")) setError("Failed: " + e.message);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  if (editableTxs) {
    return (
      <div className="fixed inset-0 z-30 bg-background">
        <ImportReview
          transactions={editableTxs}
          categories={categories}
          onDone={() => { setEditableTxs(null); toast({ title: "Transactions imported successfully!" }); }}
          onCancel={() => setEditableTxs(null)}
        />
      </div>
    );
  }

  const scoreNum = lastAnalysis?.score ? parseFloat(lastAnalysis.score) : null;
  const scorePercent = scoreNum ? (scoreNum / 10) * 100 : 0;

  return (
    <div className="space-y-3 animate-in fade-in duration-500">

      {/* Hero — sky pastel, sistema de cards de Flow */}
      <div
        className="relative overflow-hidden rounded-3xl px-5 pt-5 pb-5"
        style={{ background: "linear-gradient(145deg, #E3F4FF 0%, #BFE7FD 55%, #A5DCFB 100%)" }}
      >
        {/* Blobs decorativos suaves */}
        <div className="absolute -top-16 -right-12 w-52 h-52 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.4)" }} />
        <div className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full pointer-events-none" style={{ background: "rgba(14,165,233,0.12)" }} />

        <div className="relative">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.6)" }}
          >
            <Sparkles className="h-3 w-3" style={{ color: ACCENT }} />
            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#0369A1" }}>
              AI Powered
            </span>
          </div>

          {/* Titulo */}
          <h2 className="text-2xl font-serif font-bold leading-tight" style={{ color: "#082F49" }}>
            Financial <span style={{ color: "#0284C7" }}>Insights</span>
          </h2>
          <p className="text-xs mt-1" style={{ color: "rgba(12,74,110,0.6)" }}>
            Understand your money. Make smarter decisions.
          </p>

          {/* Health score — numero grande + medidor segmentado */}
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#0369A1" }}>
              Financial health score
            </p>
            <div className="flex items-end gap-3">
              <p className="font-serif font-bold leading-none" style={{ color: "#082F49", fontSize: "2.6rem" }}>
                {scoreNum ? lastAnalysis?.score : "—"}
                <span className="text-base font-bold ml-1" style={{ color: "rgba(8,47,73,0.4)" }}>/10</span>
              </p>
            </div>
            {/* Medidor de 10 segmentos — ADN heatmap de Flow */}
            <div className="flex gap-1 mt-2.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    background: scoreNum && i < Math.round(scoreNum)
                      ? ACCENT
                      : "rgba(8,47,73,0.10)",
                    transitionDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: "rgba(12,74,110,0.55)" }}>
              {lastAnalysis ? `Last analysis · ${lastAnalysis.date} · Gemini` : "Run your first analysis to get your score"}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={analyzeFinances}
              disabled={isAnalyzing}
              className="flex-[1.4] rounded-2xl py-3 px-3 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.97] transition-transform disabled:opacity-70 border-0 min-w-0"
              style={{ background: "#082F49", color: "#fff" }}
            >
              {isAnalyzing ? (
                <><Loader2 className="h-4 w-4 animate-spin shrink-0" /><span className="truncate text-xs">{analyzePhase}</span></>
              ) : (
                <><Sparkles className="h-4 w-4 shrink-0" /><span>{lastAnalysis ? "Refresh analysis" : "Analyze"}</span></>
              )}
            </button>
            <button
              onClick={handleUpload}
              disabled={isImporting}
              className="flex-1 rounded-2xl py-3 px-3 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.97] transition-transform disabled:opacity-70 relative overflow-hidden min-w-0"
              style={{ background: "rgba(255,255,255,0.65)", color: "#0369A1" }}
            >
              {isImporting ? (
                <><Loader2 className="h-4 w-4 animate-spin shrink-0" /><span className="text-xs">{importProgress}%</span></>
              ) : (
                <><Upload className="h-4 w-4 shrink-0" /><span>Import PDF</span></>
              )}
              {isImporting && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "rgba(14,165,233,0.2)" }}>
                  <div className="h-full transition-all duration-300" style={{ width: `${importProgress}%`, background: ACCENT }} />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Top spending categories */}
      <div className="bg-card border border-card-border rounded-3xl overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-foreground/80">Top spending this month</p>
            <p className="text-xs font-light text-muted-foreground mt-0.5">Your highest expense categories</p>
          </div>
          {topCategories.length > 0 && (
            <div className="shrink-0 px-2.5 py-1 rounded-lg bg-muted">
              <p className="text-xs font-bold text-foreground">
                {formatAmount(topCategories.reduce((sum, c) => sum + c.total, 0))}
              </p>
            </div>
          )}
        </div>
        {topCategories.length > 0 ? (
          <div className="px-4 pt-1 pb-4 space-y-2">
            {topCategories.map((cat, i) => {
              const grandTotal = topCategories.reduce((sum, c) => sum + c.total, 0);
              const share = grandTotal > 0 ? Math.round((cat.total / grandTotal) * 100) : 0;
              return (
                <div
                  key={i}
                  className="rounded-2xl px-3.5 py-3"
                  style={{ background: `${cat.categoryColor}14` }}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-tight truncate">{cat.categoryName}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {cat.count} {cat.count === 1 ? "transaction" : "transactions"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold leading-tight" style={{ color: cat.categoryColor }}>{formatAmount(cat.total)}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground leading-tight">{share}%</p>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: `${cat.categoryColor}22` }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        backgroundColor: cat.categoryColor,
                        width: `${Math.round((cat.total / topCategories[0].total) * 100)}%`,
                        transitionDelay: `${i * 120}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-2xl bg-muted flex items-center justify-center shrink-0">
              <TrendingDown className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">No spending data yet</p>
              <p className="text-xs font-light text-muted-foreground/60 mt-0.5 leading-relaxed">Add some expense transactions this month and your top categories will appear here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {insights && <InsightsModal insights={insights} onClose={() => setInsights(null)} />}
    </div>
  );
}
