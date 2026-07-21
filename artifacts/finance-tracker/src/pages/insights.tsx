import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Sparkles, Upload, Loader2, AlertCircle, X, ChevronRight, ChevronDown, Lock, Target } from "lucide-react";
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
function LockedRow({
  id, title, explain, expanded, onToggle,
}: {
  id: string; title: string; explain: string; expanded: boolean; onToggle: () => void;
}) {
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      className="rounded-xl border border-dashed border-border overflow-hidden"
      style={{ height: expanded ? 116 : 44, transition: reducedMotion ? "none" : "height 300ms cubic-bezier(0.25,0.46,0.45,0.94)" }}
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
      <p id={id} className="pl-[30px] pr-2.5 pt-1 pb-2.5 text-[11px] text-muted-foreground leading-relaxed">{explain}</p>
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
  const [expandedLockedRow, setExpandedLockedRow] = useState<"mover" | "fixedflex" | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const { data: fixedVsFlexible, error: fixedVsFlexibleQueryError } = useQuery({
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

  // "Biggest mover": antes eran hasta 8 fetches del lado del cliente (mes
  // actual + 3 pasados, cada uno con un fallback interno porque
  // /categories/spending nunca existió como endpoint real — siempre fallaba
  // y siempre caía al fallback). Ahora es un solo round-trip al backend.
  const { data: anomaly = null } = useQuery({
    queryKey: ["insights-anomaly", thisMonth, session?.user?.id],
    queryFn: async (): Promise<Anomaly | null> => {
      const r = await fetch(getApiUrl(`/api/insights/anomaly?month=${thisMonth}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!session,
    staleTime: STALE_TIME,
  });

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
          onDone={() => { setEditableTxs(null); toast({ title: "Transactions imported successfully!" }); }}
          onCancel={() => setEditableTxs(null)}
        />
      </div>
    );
  }

  const scoreNum = lastAnalysis?.score ? parseFloat(lastAnalysis.score) : null;

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

      {/* Getting started — cuando no hay nada de qué partir todavía (cuenta nueva
          o mes sin gastos cargados), en vez de dejar el espacio en blanco sin
          explicación se ve un candado por sección con una frase de qué la
          desbloquea. Tocar una fila la despliega ahí mismo (mismo truco de
          altura + overflow-hidden que la cápsula del biometric lock) con una
          explicación más larga de qué es esa sección. */}
      {(!anomaly || (!fixedVsFlexible && !fixedVsFlexibleError)) && (
        <div className="bg-card border border-card-border rounded-3xl px-5 py-4 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2.5" style={{ background: "rgba(202,250,1,0.13)" }}>
            <Target className="h-4 w-4" style={{ color: "#7CB518" }} />
          </div>
          <p className="text-sm font-bold text-foreground">Nothing to show yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px] mx-auto leading-relaxed">
            Log a few expenses and these fill in on their own:
          </p>
          <div className="mt-3 flex flex-col gap-2 text-left">
            {!anomaly && (
              <LockedRow
                id="locked-mover"
                title="Biggest mover this month"
                explain="Shows the category that changed the most vs. its own recent average — e.g. “Dining is running 2× higher than usual.” Updates on its own as you log expenses, no need to run an analysis."
                expanded={expandedLockedRow === "mover"}
                onToggle={() => setExpandedLockedRow(v => v === "mover" ? null : "mover")}
              />
            )}
            {!fixedVsFlexible && !fixedVsFlexibleError && (
              <LockedRow
                id="locked-fixedflex"
                title="Fixed vs flexible"
                explain="Splits this month's spending into what was already committed (paid Flows) vs. what was your choice — so you can see how much real wiggle room you have."
                expanded={expandedLockedRow === "fixedflex"}
                onToggle={() => setExpandedLockedRow(v => v === "fixedflex" ? null : "fixedflex")}
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
      {anomaly && (() => {
        const isNotable = anomaly.multiplier >= 1.5;
        const multColor = isNotable ? "#B45309" : undefined;
        return (
          <div
            className={cn(
              "bg-card border border-card-border rounded-3xl px-5 py-4 transition-transform",
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
            <p className="text-xs font-bold text-muted-foreground mb-2">Biggest mover this month</p>

            <div className="flex items-baseline gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: anomaly.categoryColor }} />
              <span className="text-sm font-bold text-foreground">{anomaly.categoryName}</span>
              <span
                className={cn("font-entry-amount leading-[0.8] ml-auto", !isNotable && "text-muted-foreground")}
                style={{ fontSize: "2.1rem", color: multColor }}
              >
                {anomaly.multiplier.toFixed(1)}×
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex-1">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.min(100, Math.round((anomaly.average / anomaly.thisMonth) * 100))}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">avg {formatAmount(anomaly.average)}</span>
              </div>
              <div className="flex-1">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "100%", background: isNotable ? "#B45309" : "hsl(var(--muted-foreground))" }} />
                </div>
                <span className="text-[10px] text-muted-foreground">now {formatAmount(anomaly.thisMonth)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border">
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
              {lastAnalysis?.note ? (
                <p className="text-sm text-foreground leading-relaxed">{lastAnalysis.note}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground leading-relaxed">Tap Analyze above for AI context on this</p>
              )}
            </div>

            {lastAnalysis?.fullText && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="insights-hero-title-accent text-xs font-bold">Read full analysis</span>
                <ChevronRight className="insights-hero-title-accent h-3.5 w-3.5" />
              </div>
            )}
            {lastAnalysis?.fullText && (
              <p className="text-[11px] text-muted-foreground mt-2">saved · {lastAnalysis.date} · tap to reopen, no new AI call</p>
            )}
          </div>
        );
      })()}

      {/* Fixed vs flexible — aritmética real (cruza transacciones con Flows ya
          pagados), siempre visible si hay data este mes, no depende de "Analyze". */}
      {fixedVsFlexible && (
        <div className="bg-card border border-card-border rounded-3xl px-5 py-4">
          <p className="text-xs font-bold text-muted-foreground mb-2.5">Fixed vs flexible this month</p>
          <div className="flex h-9 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wide bg-foreground text-background"
              style={{ width: `${Math.max(8, Math.round((fixedVsFlexible.fixedTotal / fixedVsFlexible.total) * 100))}%` }}
            >
              {fixedVsFlexible.fixedTotal > 0 && "Fixed"}
            </div>
            <div
              className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ width: `${Math.max(8, Math.round((fixedVsFlexible.flexibleTotal / fixedVsFlexible.total) * 100))}%`, background: ACCENT }}
            >
              {fixedVsFlexible.flexibleTotal > 0 && "Flexible"}
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex-1">
              <p className="font-entry-amount text-2xl leading-none text-foreground">{formatAmount(fixedVsFlexible.fixedTotal)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">Fixed — Flows already committed</p>
            </div>
            <div className="flex-1">
              <p className="font-entry-amount text-2xl leading-none text-foreground">{formatAmount(fixedVsFlexible.flexibleTotal)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">Flexible — your call</p>
            </div>
          </div>
        </div>
      )}
      {!fixedVsFlexible && fixedVsFlexibleError && (
        <p className="text-[11px] text-muted-foreground px-1">Fixed vs flexible: {fixedVsFlexibleError}</p>
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
