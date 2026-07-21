import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Sparkles, Upload, Loader2, AlertCircle, X, ChevronRight } from "lucide-react";
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

interface Anomaly {
  categoryName: string;
  categoryColor: string;
  thisMonth: number;
  average: number;
  multiplier: number;
}

type TakeType = "warning" | "positive" | "tip" | "surprise";

interface Finding {
  type: TakeType;
  text: string;
}

interface LastAnalysis {
  date: string;
  score: string | null;
  /** Hallazgos reales de Gemini (respuesta JSON estructurada, no texto libre
   * recortado con regex) — siempre 3, con tipo real. El de "surprise" no viene
   * acá, se agrega aparte porque es dato calculado en el cliente (anomaly). */
  findings: Finding[];
  /** Reporte completo — persistido para que "Read full analysis" reabra el
   * último análisis sin gastar otra llamada a Gemini. Entradas viejas de
   * localStorage (guardadas antes de este campo) simplemente no lo tienen. */
  fullText?: string;
}

// Antes un ícono de 20px era la única señal de "tipo" — muy chico para leerse
// de un vistazo, terminaba pareciendo "todo el mismo color". La etiqueta de
// palabra en color de fondo sólido es la señal real: se lee antes que el texto.
const TAKE_STYLES: Record<TakeType, { bg: string; label: string }> = {
  warning: { bg: "#B45309", label: "Heads up" },
  positive: { bg: "#047857", label: "Nice" },
  tip: { bg: "#0369A1", label: "Try this" },
  surprise: { bg: "#B45309", label: "Surprise" },
};

function QuickTakeRow({ type, children }: { type: TakeType; children: React.ReactNode }) {
  const { bg, label } = TAKE_STYLES[type];
  return (
    <div className="flex gap-2.5 items-start">
      <span
        className="shrink-0 mt-0.5 text-[9px] font-black uppercase tracking-wide text-white px-1.5 py-0.5 rounded"
        style={{ background: bg }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function GhostTakeRow({ type, example }: { type: TakeType; example: string }) {
  const { bg, label } = TAKE_STYLES[type];
  return (
    <div className="flex gap-2.5 items-start opacity-50">
      <span
        className="shrink-0 mt-0.5 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border border-dashed"
        style={{ borderColor: bg, color: bg }}
      >
        {label}
      </span>
      <p className="text-sm italic text-muted-foreground leading-relaxed">{example}</p>
    </div>
  );
}

// Gasto por categoría de un mes dado — misma llamada que ya usaba "Top spending",
// factoreada para poder pedir varios meses (mes actual + históricos para la anomalía).
async function fetchCategorySpending(month: string, token: string | undefined): Promise<TopCategory[]> {
  try {
    const r = await fetch(getApiUrl(`/api/categories/spending?type=expense&month=${month}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    const data = d.data || d;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((c: any) => ({
        categoryName: c.categoryName || c.name,
        categoryColor: c.categoryColor || c.color,
        total: c.total || c.amount,
        count: c.count || c.transactionCount || 1,
      }));
    }
  } catch {}
  // Fallback: agrupar desde el endpoint de transacciones directamente
  try {
    const r = await fetch(getApiUrl(`/api/transactions?month=${month}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    const txs = d.data || d;
    if (!Array.isArray(txs)) return [];
    const expenses = txs.filter((t: any) => t.type === "expense");
    const grouped: Record<string, TopCategory> = {};
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
    return Object.values(grouped);
  } catch {
    return [];
  }
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
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center">
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
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<LastAnalysis | null>(() => {
    try {
      const saved = localStorage.getItem("ff-last-analysis");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const token = session?.access_token;

    fetch(getApiUrl("/api/categories"), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setCategories(d.data || d))
      .catch(() => {});

    const now = new Date();
    const monthKey = (offset: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    fetchCategorySpending(monthKey(0), token).then(data => {
      // Anomalía: comparar cada categoría de este mes contra su promedio de los
      // últimos 3 meses. Solo se muestra si hay historial real y el salto es
      // grande — si no, se queda en null y la card ni aparece.
      Promise.all([1, 2, 3].map(o => fetchCategorySpending(monthKey(-o), token))).then(pastMonths => {
        const history: Record<string, { sum: number; color: string }> = {};
        for (const monthData of pastMonths) {
          for (const c of monthData) {
            if (!history[c.categoryName]) history[c.categoryName] = { sum: 0, color: c.categoryColor };
            history[c.categoryName].sum += c.total;
          }
        }
        let best: Anomaly | null = null;
        for (const c of data) {
          const hist = history[c.categoryName];
          const average = hist ? hist.sum / 3 : 0;
          if (average < 5) continue;
          const multiplier = c.total / average;
          if (multiplier >= 1.5 && (!best || multiplier > best.multiplier)) {
            best = { categoryName: c.categoryName, categoryColor: c.categoryColor, thisMonth: c.total, average, multiplier };
          }
        }
        setAnomaly(best);
      });
    });
  }, [session]);

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
      const narrative = result.narrative;
      if (!narrative || !Array.isArray(result.findings)) throw new Error("No response from AI");

      // Save last analysis to localStorage — fullText incluido para poder reabrir
      // el reporte completo después ("Read full analysis" en Quick take) sin
      // gastar otra llamada a Gemini.
      const analysis: LastAnalysis = {
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        score: typeof result.score === "number" ? result.score.toFixed(1) : null,
        findings: result.findings,
        fullText: narrative,
      };
      setLastAnalysis(analysis);
      try { localStorage.setItem("ff-last-analysis", JSON.stringify(analysis)); } catch {}

      setInsights(narrative);
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
      <div className="fixed inset-0 z-50 bg-background">
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

      {/* Hero — gradiente sky pastel (vuelta a la composición original), con su propia
          variante oscura esta vez y contraste real verificado en los dos temas. */}
      <div className="insights-hero relative overflow-hidden rounded-3xl px-4 pt-4 pb-4">
        {/* Badge */}
        <div className="insights-hero-badge inline-flex items-center gap-1.5 mb-2.5 px-2.5 py-1 rounded-lg">
          <Sparkles className="h-3 w-3" style={{ color: ACCENT }} />
          <span className="text-[10px] font-bold tracking-widest uppercase">
            AI Powered
          </span>
        </div>

        {/* Titulo */}
        <h2 className="insights-hero-title font-title text-xl leading-tight">
          Financial <span className="insights-hero-title-accent">Insights</span>
        </h2>
        <p className="insights-hero-muted text-xs mt-1">
          Understand your money. Make smarter decisions.
        </p>

        {/* Health score — numero grande + medidor segmentado */}
        <div className="mt-3">
          <p className="insights-hero-muted text-[10px] font-bold uppercase tracking-widest mb-1">
            Financial health score
          </p>
          <div className="flex items-end gap-3">
            <p className="insights-hero-title font-number leading-none" style={{ fontSize: "2.2rem" }}>
              {scoreNum ? lastAnalysis?.score : "—"}
              <span className="insights-hero-muted text-sm font-bold ml-1">/10</span>
            </p>
          </div>
          {/* Medidor de 10 segmentos — ADN heatmap de Flow */}
          <div className="flex gap-1 mt-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={cn("flex-1 h-2 rounded-full transition-all duration-500", !(scoreNum && i < Math.round(scoreNum)) && "insights-hero-meter-off")}
                style={{
                  background: scoreNum && i < Math.round(scoreNum) ? ACCENT : undefined,
                  transitionDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
          <p className="insights-hero-muted text-[11px] mt-1.5">
            {lastAnalysis ? `Last analysis · ${lastAnalysis.date} · Gemini` : "Run your first analysis to get your score"}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={analyzeFinances}
            disabled={isAnalyzing}
            className="insights-hero-btn-primary flex-[1.4] rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 text-[13px] font-bold active:scale-[0.97] transition-transform disabled:opacity-70 border-0 min-w-0 whitespace-nowrap"
          >
            {isAnalyzing ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /><span className="truncate text-xs">{analyzePhase}</span></>
            ) : (
              <><Sparkles className="h-3.5 w-3.5 shrink-0" /><span>{lastAnalysis ? "Refresh analysis" : "Analyze"}</span></>
            )}
          </button>
          <button
            onClick={handleUpload}
            disabled={isImporting}
            className="insights-hero-btn-secondary flex-1 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 text-[13px] font-bold active:scale-[0.97] transition-transform disabled:opacity-70 relative overflow-hidden min-w-0 whitespace-nowrap"
          >
            {isImporting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /><span className="text-xs">{importProgress}%</span></>
            ) : (
              <><Upload className="h-3.5 w-3.5 shrink-0" /><span>Import PDF</span></>
            )}
            {isImporting && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10">
                <div className="h-full transition-all duration-300" style={{ width: `${importProgress}%`, background: ACCENT }} />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Quick take — una sola card: la anomalía ("Biggest surprise") ya no vive
          suelta abajo, es una fila más acá (tipada, con su mini-gráfico inline).
          Tappeable entera: reabre el reporte completo YA persistido (fullText),
          sin gastar otra llamada a Gemini — "Refresh analysis" en el hero sigue
          siendo el único botón que re-analiza de verdad. */}
      <div
        className={cn(
          "bg-card border border-card-border rounded-3xl px-5 py-4 transition-transform",
          lastAnalysis?.fullText && "active:scale-[0.99] cursor-pointer"
        )}
        onClick={() => { if (lastAnalysis?.fullText) setInsights(lastAnalysis.fullText); }}
        role={lastAnalysis?.fullText ? "button" : undefined}
        tabIndex={lastAnalysis?.fullText ? 0 : undefined}
      >
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-foreground/80 mb-3">
          <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          Quick take
        </p>
        {lastAnalysis ? (
          <>
            <div className="space-y-2.5">
              {anomaly && (
                <QuickTakeRow type="surprise">
                  <p className="text-sm text-foreground leading-relaxed">
                    <b className="font-bold">{anomaly.categoryName}</b> is running {anomaly.multiplier.toFixed(1)}× your usual — biggest surprise this month
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex-1">
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.min(100, Math.round((anomaly.average / anomaly.thisMonth) * 100))}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">avg {formatAmount(anomaly.average)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: "100%", background: "#B45309" }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">now {formatAmount(anomaly.thisMonth)}</span>
                    </div>
                  </div>
                </QuickTakeRow>
              )}
              {(lastAnalysis.findings ?? []).map((f, i) => (
                <QuickTakeRow key={i} type={f.type}>
                  <p className="text-sm text-foreground leading-relaxed">{f.text}</p>
                </QuickTakeRow>
              ))}
            </div>

            {lastAnalysis.fullText && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-xs font-bold" style={{ color: ACCENT }}>Read full analysis</span>
                <ChevronRight className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              {lastAnalysis.fullText ? `saved · ${lastAnalysis.date} · tap to reopen, no new AI call` : `Based on your last analysis · ${lastAnalysis.date}`}
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2.5">
              <GhostTakeRow type="surprise" example={'e.g. "Dining spend jumped vs. your usual"'} />
              <GhostTakeRow type="positive" example={'e.g. "Where you\'re staying on budget"'} />
              <GhostTakeRow type="tip" example={'e.g. "A concrete way to save more"'} />
            </div>
            <p className="text-xs font-bold mt-3 pt-3 border-t border-border" style={{ color: ACCENT }}>
              ↑ Tap Analyze above — these fill in with your real numbers
            </p>
          </>
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
