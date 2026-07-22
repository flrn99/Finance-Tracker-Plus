import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetMonthlyTrendQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Sparkles, Upload, Loader2, AlertCircle, X, ChevronRight, ChevronDown, Lock, Target, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCurrency } from "@/lib/currency-context";
import { getApiUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import ImportReview from "@/components/import-review";
import { useToast } from "@/hooks/use-toast";

// La API key de Gemini vive en el backend — ya NO se hornea en el APK

const ACCENT = "#0EA5E9";
// Terracota/naranja para Fixed vs flexible — complementario del celeste del
// hero (opuestos en la rueda cromática, arman contraste real en vez de
// perderse al lado) y no pisa ningún significado ya usado en la app (verde =
// income, rojo = expense-negativo, ambos intocables).
const FIXED_COLOR = "#C2410C";
const FLEXIBLE_COLOR = "#FB923C";

interface EditableTx {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId: number | null;
  selected: boolean;
}

interface Anomaly {
  categoryName: string;
  categoryColor: string;
  thisMonth: number;
  average: number;
  multiplier: number;
}

interface LastAnalysis {
  date: string;
  score: string | null;
  /** Una sola frase de interpretación de Gemini, anclada al "biggest mover"
   * real (anomaly) — no una lista de hallazgos inventados. Si no hubo nada
   * notorio ese mes, Gemini lo dice honestamente en vez de omitir la frase. */
  note: string;
  /** Reporte completo — persistido para que "Read full analysis" reabra el
   * último análisis sin gastar otra llamada a Gemini. Entradas viejas de
   * localStorage (guardadas antes de este campo) simplemente no lo tienen. */
  fullText?: string;
}

interface FixedVsFlexible {
  fixedTotal: number;
  flexibleTotal: number;
  total: number;
  biggestFixedFlow: { name: string; amount: number; color: string | null } | null;
}

interface IncomeConsistency {
  thisMonth: number;
  average: number;
  delta: number;
  hasHistory: boolean;
}

interface SavingsRate {
  rate: number;
  income: number;
  expense: number;
  saved: number;
}

function InsightsModal({ insights, onClose }: { insights: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your Financial Report"
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

/** Fila "bloqueada" dentro de la card de empty state — tocarla la despliega en el
 * lugar (mismo truco de altura explícita + overflow-hidden que ya usa la cápsula
 * del biometric lock) en vez de abrir algo aparte, para explicar qué es esa
 * sección sin que el usuario tenga que adivinar por qué está vacía. */
const LOCKED_ROW_BUTTON_HEIGHT = 44;

function LockedRow({
  id, title, explain, expanded, onToggle,
}: {
  id: string; title: string; explain: string; expanded: boolean; onToggle: () => void;
}) {
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Antes esto era un número fijo (116px) que asumía que el texto de explicación
  // entraba en 3 líneas — "Biggest mover" es más largo que "Fixed vs flexible" y
  // se cortaba a la mitad de una palabra por el overflow-hidden. Medimos la
  // altura real del párrafo (incluye su propio padding) para que la fila crezca
  // lo que el texto realmente necesita, sea cual sea su largo o el ancho de pantalla.
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setContentHeight(contentRef.current.scrollHeight);
  }, [explain]);

  return (
    <div
      className="rounded-xl border border-dashed border-border overflow-hidden"
      style={{
        height: expanded ? LOCKED_ROW_BUTTON_HEIGHT + contentHeight : LOCKED_ROW_BUTTON_HEIGHT,
        transition: reducedMotion ? "none" : "height 300ms cubic-bezier(0.25,0.46,0.45,0.94)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={id}
        className="w-full h-11 flex items-center gap-2 px-2.5 text-left"
      >
        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold text-muted-foreground flex-1 truncate">{title}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-300", expanded && "rotate-180")} />
      </button>
      {/* pl-[30px] alinea con el título de arriba (10px de padding del botón +
          12px del ícono de candado + 8px de gap), no con el borde del botón —
          antes quedaba corrido a la izquierda respecto al texto de la fila. */}
      <p ref={contentRef} id={id} className="pl-[30px] pr-2.5 pt-1 pb-2.5 text-[11px] text-muted-foreground leading-relaxed">{explain}</p>
    </div>
  );
}

export default function Insights() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { currency, formatAmount } = useCurrency();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [analyzePhase, setAnalyzePhase] = useState("");
  const [insights, setInsights] = useState<string | null>(null);
  const [editableTxs, setEditableTxs] = useState<EditableTx[] | null>(null);
  // Scoped por userId: la key global vieja hacía que, en un teléfono
  // compartido por más de una cuenta, el usuario B viera el score/análisis
  // financiero del usuario A hasta correr su propio análisis.
  const lastAnalysisKey = (userId: string | undefined) => `ff-last-analysis-${userId ?? "anon"}`;
  const [lastAnalysis, setLastAnalysis] = useState<LastAnalysis | null>(() => {
    try {
      const saved = localStorage.getItem(lastAnalysisKey(session?.user?.id));
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [expandedLockedRow, setExpandedLockedRow] = useState<"mover" | "fixedflex" | "income" | "savings" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeLens, setActiveLens] = useState<"expense" | "income">("expense");

  const now = new Date();
  const monthKey = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const thisMonth = monthKey(0);
  const token = session?.access_token;

  // Re-sincroniza si cambia el usuario logueado sin que el componente se
  // desmonte (cambio de cuenta en el mismo dispositivo).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(lastAnalysisKey(session?.user?.id));
      setLastAnalysis(saved ? JSON.parse(saved) : null);
    } catch { setLastAnalysis(null); }
  }, [session?.user?.id]);

  // Antes esto vivía en un useEffect + useState local — cada vez que se salía
  // de Insights y se volvía, el componente se desmontaba, el estado se perdía
  // del todo, y había que esperar a que las 4 llamadas de categorías + el
  // fetch de fixed-vs-flexible volvieran a resolver para ver algo de nuevo.
  // React Query (ya usado en el resto de la app) cachea esto entre
  // navegaciones — se ve lo último que había al instante, y solo refresca en
  // segundo plano si pasaron más de 5 minutos.
  const STALE_TIME = 5 * 60 * 1000;

  const { data: categories = [] } = useQuery({
    queryKey: ["insights-categories", session?.user?.id],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/categories"), { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      return d.data || d;
    },
    enabled: !!session,
    staleTime: STALE_TIME,
  });

  const { data: fixedVsFlexible, error: fixedVsFlexibleQueryError, isLoading: fixedVsFlexibleLoading } = useQuery({
    queryKey: ["insights-fixed-vs-flexible", thisMonth, session?.user?.id],
    queryFn: async (): Promise<FixedVsFlexible | null> => {
      const r = await fetch(getApiUrl(`/api/insights/fixed-vs-flexible?month=${thisMonth}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}${r.status === 404 ? " — backend deploy pendiente" : ""}`);
      const d = await r.json();
      return d && d.total > 0 ? d : null;
    },
    enabled: !!session,
    staleTime: STALE_TIME,
  });
  // El diagnóstico visible del fetch — el usuario no usa ADB, así que un
  // console.error no le sirve para nada en el teléfono real.
  const fixedVsFlexibleError = fixedVsFlexibleQueryError instanceof Error ? fixedVsFlexibleQueryError.message : null;

  // "Category on the move" + "Biggest expense": antes eran hasta 8 fetches del
  // lado del cliente (mes actual + 3 pasados, cada uno con un fallback interno
  // porque /categories/spending nunca existió como endpoint real — siempre
  // fallaba y siempre caía al fallback). Ahora es un solo round-trip al backend,
  // que devuelve las dos señales juntas porque comparten la misma consulta base.
  const { data: anomalyData, isLoading: anomalyLoading } = useQuery({
    queryKey: ["insights-anomaly", thisMonth, session?.user?.id],
    queryFn: async (): Promise<{ mover: Anomaly | null }> => {
      const r = await fetch(getApiUrl(`/api/insights/anomaly?month=${thisMonth}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!session,
    staleTime: STALE_TIME,
  });
  const anomaly = anomalyData?.mover ?? null;

  // Income consistency + savings rate — mismo patrón de un solo round-trip
  // que "biggest mover", para el lado de Income del lens toggle.
  const { data: incomeSummary, isLoading: incomeSummaryLoading } = useQuery({
    queryKey: ["insights-income-summary", thisMonth, session?.user?.id],
    queryFn: async (): Promise<{ income: IncomeConsistency | null; savingsRate: SavingsRate | null }> => {
      const r = await fetch(getApiUrl(`/api/insights/income-summary?month=${thisMonth}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!session,
    staleTime: STALE_TIME,
  });
  const incomeConsistency = incomeSummary?.income ?? null;
  const savingsRate = incomeSummary?.savingsRate ?? null;

  // Distingue "todavía está cargando" de "ya cargó y no hay nada" — antes se
  // mostraba directo el empty-state ("Nothing to show yet") mientras las
  // queries todavía estaban en vuelo, y se sentía como que la app no tenía
  // data en vez de que estaba esperando la respuesta del backend.
  const expenseLoading = anomalyLoading || fixedVsFlexibleLoading;
  const incomeLoading = incomeSummaryLoading;

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
        // Le mandamos el "biggest mover" que ya calculamos acá mismo, para que
        // Gemini escriba UNA frase de contexto anclada a ESE número real en vez
        // de inventar su propio hallazgo que podría no coincidir con la pantalla.
        body: JSON.stringify({ currency, anomaly }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result?.error || "Failed to analyze finances");
        return;
      }
      const narrative = result.narrative;
      if (!narrative || typeof result.note !== "string") throw new Error("No response from AI");

      // Save last analysis to localStorage — fullText incluido para poder reabrir
      // el reporte completo después ("Read full analysis" en Quick take) sin
      // gastar otra llamada a Gemini.
      const analysis: LastAnalysis = {
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        score: typeof result.score === "number" ? result.score.toFixed(1) : null,
        note: result.note,
        fullText: narrative,
      };
      setLastAnalysis(analysis);
      try { localStorage.setItem(lastAnalysisKey(session?.user?.id), JSON.stringify(analysis)); } catch {}

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
          onDone={() => {
            setEditableTxs(null);
            toast({ title: "Transactions imported successfully!" });
            // El import de PDF crea transacciones con fetch crudo, no con las
            // mutations de react-query — nada se invalidaba antes, así que ni
            // Insights ni el dashboard ni Transactions veían lo importado
            // hasta cerrar y reabrir la app.
            queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
            queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
            queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
            queryClient.invalidateQueries({ queryKey: ["insights-anomaly"] });
            queryClient.invalidateQueries({ queryKey: ["insights-fixed-vs-flexible"] });
            queryClient.invalidateQueries({ queryKey: ["insights-income-summary"] });
          }}
          onCancel={() => setEditableTxs(null)}
        />
      </div>
    );
  }

  const scoreNum = lastAnalysis?.score ? parseFloat(lastAnalysis.score) : null;

  return (
    <div className="space-y-2.5 animate-in fade-in duration-500">

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

        {/* Titulo — "Financial" sobraba, ya estás en la sección de Insights */}
        <h2 className="insights-hero-title-accent font-title text-xl leading-tight">
          Insights
        </h2>
        <p className="insights-hero-muted text-xs mt-1">
          Understand your money. Make smarter decisions.
        </p>

        {/* Health score — numero grande + medidor segmentado */}
        <div className="mt-3">
          <p className="insights-hero-muted text-[10px] font-bold uppercase tracking-widest mb-1">
            Overall financial health score
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
            className="insights-hero-btn-primary flex-[1.4] min-h-11 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 text-[13px] font-bold active:scale-[0.97] transition-transform disabled:opacity-70 border-0 min-w-0 whitespace-nowrap"
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
            className="insights-hero-btn-secondary flex-1 min-h-11 rounded-2xl py-2.5 px-3 flex items-center justify-center gap-1.5 text-[13px] font-bold active:scale-[0.97] transition-transform disabled:opacity-70 relative overflow-hidden min-w-0 whitespace-nowrap"
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

      {/* Lens toggle — mismo look que el Expense/Income de EntrySheet (mismos
          colores #FF4D4D/#00A870), para que se sienta como el mismo control,
          no uno nuevo. Cada lente tiene su propio "getting started" abajo. */}
      <div className="relative flex items-center rounded-full bg-muted p-1">
        <div
          className="absolute top-1 left-1 rounded-full transition-transform duration-300 ease-out"
          style={{
            bottom: "4px",
            width: "calc(50% - 4px)",
            transform: activeLens === "expense" ? "translateX(0%)" : "translateX(100%)",
            background: activeLens === "expense" ? "#FF4D4D" : "#00A870",
          }}
        />
        <button
          type="button"
          onClick={() => setActiveLens("expense")}
          aria-pressed={activeLens === "expense"}
          className={cn(
            "relative z-10 flex-1 min-h-11 flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors duration-300",
            activeLens === "expense" ? "text-white" : "text-foreground/50"
          )}
        >
          <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />
          Expense
        </button>
        <button
          type="button"
          onClick={() => setActiveLens("income")}
          aria-pressed={activeLens === "income"}
          className={cn(
            "relative z-10 flex-1 min-h-11 flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors duration-300",
            activeLens === "income" ? "text-white" : "text-foreground/50"
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          Income
        </button>
      </div>

      {/* Skeleton — antes se mostraba directo "Nothing to show yet" mientras
          las queries todavía estaban en vuelo (cold start o justo después de
          invalidar por una transacción nueva), y se leía como que no había
          data en vez de que estaba cargando. */}
      {((activeLens === "expense" && expenseLoading) || (activeLens === "income" && incomeLoading)) && (
        <>
          <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5 animate-pulse">
            <div className="h-3 w-32 rounded-full bg-muted mb-2.5" />
            <div className="h-6 w-40 rounded-full bg-muted mb-2.5" />
            <div className="h-1 w-full rounded-full bg-muted" />
          </div>
          <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5 animate-pulse">
            <div className="h-3 w-32 rounded-full bg-muted mb-2.5" />
            <div className="h-8 w-full rounded-xl bg-muted" />
          </div>
        </>
      )}

      {/* Getting started — cuando no hay nada de qué partir todavía (cuenta nueva
          o mes sin datos de este lente cargados), en vez de dejar el espacio en
          blanco sin explicación se ve un candado por sección con una frase de qué
          la desbloquea. Tocar una fila la despliega ahí mismo (mismo truco de
          altura + overflow-hidden que la cápsula del biometric lock) con una
          explicación más larga de qué es esa sección. El ícono usa el mismo rojo/
          verde que el toggle de arriba, para que quede claro de qué lente es. */}
      {activeLens === "expense" && !expenseLoading && (!anomaly || (!fixedVsFlexible && !fixedVsFlexibleError)) && (
        <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5 text-center">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: "rgba(255,77,77,0.13)" }}>
            <Target className="h-4 w-4" style={{ color: "#FF4D4D" }} />
          </div>
          <p className="text-sm font-bold text-foreground">Nothing to show yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto leading-relaxed">
            Log a few expenses and these fill in on their own:
          </p>
          <div className="mt-3 flex flex-col gap-2 text-left">
            {!anomaly && (
              <LockedRow
                id="locked-mover"
                title="Category on the move this month"
                explain="Shows the category that changed the most vs. its own recent average — e.g. “Dining is running 2× higher than usual.” Updates on its own as you log expenses, no need to run an analysis."
                expanded={expandedLockedRow === "mover"}
                onToggle={() => setExpandedLockedRow(v => v === "mover" ? null : "mover")}
              />
            )}
            {!fixedVsFlexible && !fixedVsFlexibleError && (
              <LockedRow
                id="locked-fixedflex"
                title="Fixed vs flexible spending"
                explain="Splits this month's spending into what was already committed (paid Flows) vs. what was your choice — so you can see how much real wiggle room you have."
                expanded={expandedLockedRow === "fixedflex"}
                onToggle={() => setExpandedLockedRow(v => v === "fixedflex" ? null : "fixedflex")}
              />
            )}
          </div>
        </div>
      )}

      {activeLens === "income" && !incomeLoading && (!incomeConsistency || !savingsRate) && (
        <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5 text-center">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: "rgba(0,168,112,0.13)" }}>
            <Target className="h-4 w-4" style={{ color: "#00A870" }} />
          </div>
          <p className="text-sm font-bold text-foreground">Nothing to show yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto leading-relaxed">
            Log a bit of income and these fill in on their own:
          </p>
          <div className="mt-3 flex flex-col gap-2 text-left">
            {!incomeConsistency && (
              <LockedRow
                id="locked-income"
                title="Income consistency this month"
                explain="Compares this month's income to your recent average — flags anything unusually high or low, no matter where it came from."
                expanded={expandedLockedRow === "income"}
                onToggle={() => setExpandedLockedRow(v => v === "income" ? null : "income")}
              />
            )}
            {!savingsRate && (
              <LockedRow
                id="locked-savings"
                title="Savings rate this month"
                explain="Shows how much of what you earned this month you actually kept, once fixed and flexible spending are subtracted."
                expanded={expandedLockedRow === "savings"}
                onToggle={() => setExpandedLockedRow(v => v === "savings" ? null : "savings")}
              />
            )}
          </div>
        </div>
      )}

      {/* Biggest mover — un solo headline, no una lista de frases. El número y
          las barras son aritmética real (anomaly, calculado acá mismo contra
          el promedio de 3 meses) y se muestran siempre que haya historial,
          sea o no un salto grande — un mes tranquilo lo dice honesto en vez de
          desaparecer. La única frase de Gemini interpreta ESE número real,
          nunca inventa el suyo. Tappeable entera: reabre el reporte completo
          ya persistido (fullText), sin gastar otra llamada a Gemini —
          "Refresh analysis" en el hero sigue siendo el único que re-analiza. */}
      {activeLens === "expense" && anomaly && (() => {
        const isNotable = anomaly.multiplier >= 1.5;
        const multColor = isNotable ? "#B45309" : undefined;
        return (
          <div
            className={cn(
              "bg-card border border-card-border rounded-3xl px-4 py-3.5 transition-transform",
              lastAnalysis?.fullText && "active:scale-[0.99] cursor-pointer"
            )}
            onClick={() => { if (lastAnalysis?.fullText) setInsights(lastAnalysis.fullText); }}
            onKeyDown={(e) => {
              if (!lastAnalysis?.fullText) return;
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setInsights(lastAnalysis.fullText!); }
            }}
            role={lastAnalysis?.fullText ? "button" : undefined}
            tabIndex={lastAnalysis?.fullText ? 0 : undefined}
          >
            <p className="text-xs font-bold text-muted-foreground mb-1.5">Category on the move this month</p>

            <div className="flex items-baseline gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: anomaly.categoryColor }} />
              <span className="text-sm font-bold text-foreground">{anomaly.categoryName}</span>
              <span
                className={cn("font-entry-amount leading-[0.8] ml-auto flex items-baseline gap-1", !isNotable && "text-muted-foreground")}
                style={{ fontSize: "1.7rem", color: multColor }}
              >
                {anomaly.multiplier.toFixed(1)}×
                <span className="text-[10px] font-bold text-muted-foreground">usual</span>
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.min(100, Math.round((anomaly.average / anomaly.thisMonth) * 100))}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">your usual {formatAmount(anomaly.average)}</span>
              </div>
              <div className="flex-1">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "100%", background: isNotable ? "#B45309" : "hsl(var(--muted-foreground))" }} />
                </div>
                <span className="text-[10px] text-muted-foreground">this month {formatAmount(anomaly.thisMonth)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 mt-2.5 pt-2.5 border-t border-border">
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
              {lastAnalysis?.note ? (
                <p className="text-sm text-foreground leading-relaxed">{lastAnalysis.note}</p>
              ) : (
                <p className="text-xs italic text-muted-foreground leading-relaxed">Tap Analyze above for AI context on this</p>
              )}
            </div>

            {lastAnalysis?.fullText && (
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
                <span className="insights-accent-text text-xs font-bold">Read full analysis</span>
                <ChevronRight className="insights-accent-text h-3.5 w-3.5" />
              </div>
            )}
            {lastAnalysis?.fullText && (
              <p className="text-[11px] text-muted-foreground mt-1.5">saved · {lastAnalysis.date} · tap to reopen, no new AI call</p>
            )}
          </div>
        );
      })()}

      {/* Fixed vs flexible — aritmética real (cruza transacciones con Flows ya
          pagados), siempre visible si hay data este mes, no depende de "Analyze".
          El Flow más grande dentro de "Fixed" vivía antes en una card aparte
          ("Biggest expense") que terminaba mostrando la misma categoría que
          "Category on the move" casi siempre — acá vive donde pertenece
          conceptualmente, como parte de lo que ya es fijo. Terracota/naranja
          en vez de negro/celeste: complementario del celeste del hero, y no
          pisa ningún significado ya usado (verde=income, rojo=expense-negativo). */}
      {activeLens === "expense" && fixedVsFlexible && (() => {
        const { fixedTotal, flexibleTotal, total, biggestFixedFlow } = fixedVsFlexible;
        let caption: string;
        if (fixedTotal === 0) {
          caption = `Nothing committed yet — all ${formatAmount(flexibleTotal)} this month was your call.`;
        } else if (flexibleTotal === 0) {
          caption = biggestFixedFlow
            ? `${biggestFixedFlow.name} is your largest fixed commitment at ${formatAmount(biggestFixedFlow.amount)}. Nothing flexible this month — it was all already committed.`
            : `${formatAmount(fixedTotal)} was already committed. Nothing flexible this month.`;
        } else if (biggestFixedFlow) {
          caption = `${biggestFixedFlow.name} is your largest fixed commitment at ${formatAmount(biggestFixedFlow.amount)}. The rest (${formatAmount(flexibleTotal)}) was your call this month.`;
        } else {
          caption = `${formatAmount(fixedTotal)} was already committed. The rest (${formatAmount(flexibleTotal)}) was your call this month.`;
        }
        return (
          <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5">
            <p className="text-xs font-bold text-muted-foreground mb-2">Fixed vs flexible spending this month</p>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div style={{ width: `${Math.max(4, Math.round((fixedTotal / total) * 100))}%`, background: FIXED_COLOR }} />
              <div style={{ width: `${Math.max(4, Math.round((flexibleTotal / total) * 100))}%`, background: FLEXIBLE_COLOR }} />
            </div>
            {/* Cada etiqueta pegada directo arriba de SU monto — antes vivían
                separadas como una leyenda compartida y el único vínculo entre
                cada número y su nombre era el color, había que ir y volver
                con la vista para asociarlos. */}
            <div className="flex gap-5 mt-2.5">
              <div className="flex-1">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: FIXED_COLOR }} />
                  Fixed
                </span>
                <p className="font-entry-amount text-xl leading-none" style={{ color: FIXED_COLOR }}>{formatAmount(fixedTotal)}</p>
              </div>
              <div className="flex-1">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: FLEXIBLE_COLOR }} />
                  Flexible
                </span>
                <p className="font-entry-amount text-xl leading-none text-foreground">{formatAmount(flexibleTotal)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{caption}</p>
          </div>
        );
      })()}
      {activeLens === "expense" && !fixedVsFlexible && fixedVsFlexibleError && (
        <p className="text-[11px] text-muted-foreground px-1">Fixed vs flexible: {fixedVsFlexibleError}</p>
      )}

      {/* Income consistency — mismo criterio que "biggest mover": promedio solo
          sobre meses con ingreso real, se muestra siempre que haya historial. */}
      {activeLens === "income" && incomeConsistency && (
        <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5">
          <p className="text-xs font-bold text-muted-foreground mb-1.5">Income consistency this month</p>
          <div className="flex items-baseline gap-2">
            <span className="font-entry-amount leading-[0.8] text-foreground" style={{ fontSize: "1.7rem" }}>
              {formatAmount(incomeConsistency.thisMonth)}
            </span>
            {incomeConsistency.hasHistory && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
                style={{ color: "#00A870", background: "rgba(0,168,112,0.14)" }}
              >
                {incomeConsistency.delta >= 0 ? "+" : ""}{incomeConsistency.delta.toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {incomeConsistency.hasHistory
              ? `Averaging ${formatAmount(incomeConsistency.average)} over the last few months — ${
                  Math.abs(incomeConsistency.delta) < 10
                    ? "steady, nothing to flag."
                    : incomeConsistency.delta > 0
                    ? "running ahead of your usual pace."
                    : "running behind your usual pace."
                }`
              : "First month we can compare — check back next month for a trend."}
          </p>
        </div>
      )}

      {/* Savings rate — usa el gasto real transaccionado del mes (no el
          "Fixed" configurado de Flows), así que puede diferir un poco de lo
          que se ve en el lente de Expense si hay Flows sin pagar todavía. */}
      {activeLens === "income" && savingsRate && (
        <div className="bg-card border border-card-border rounded-3xl px-4 py-3.5">
          <p className="text-xs font-bold text-muted-foreground mb-1.5">Savings rate this month</p>
          <p className="font-entry-amount leading-[0.8] text-foreground" style={{ fontSize: "1.7rem" }}>
            {savingsRate.rate.toFixed(0)}%
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, savingsRate.rate))}%`, background: "#00A870" }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {formatAmount(savingsRate.saved)} kept out of {formatAmount(savingsRate.income)} earned ({formatAmount(savingsRate.expense)} spent this month).
          </p>
        </div>
      )}

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
