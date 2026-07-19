import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Mic, X, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api-config";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/lib/currency-context";

const FLOW = "#CAFA01";
// Antes fijo en paper claro siempre — ahora sigue el theme real de la app,
// mismos tokens que el resto (hsl(var(--background/foreground))).
const PAPER = "hsl(var(--background))";
const INK = "hsl(var(--foreground))";
// Flow Green en sí NO cambia con el theme — siempre necesita texto/ícono oscuro
// encima (falla contraste con blanco), así que cualquier cosa sobre un fondo
// FLOW usa esto en vez de INK, que en dark mode se volvería claro y rompería el contraste.
const FLOW_INK = "#14140F";
const SILENCE_MS = 1200;        // auto-stop tras 1.2s de silencio (antes 2.5s — se sentía lento)
const SILENCE_THRESHOLD = 0.04;  // nivel de volumen considerado "silencio"
const SPEECH_THRESHOLD = 0.08;   // por encima de esto = el usuario esta hablando

export interface ParsedVoiceTx {
  amount: number;
  type: "expense" | "income";
  categoryId: number | null;
  categoryName: string | null;
  description: string;
}

type Phase = "listening" | "processing" | "revealing" | "error";

// ── Waveform reactivo: 40 barras que responden al micro en vivo ──────────────
function Waveform({ levelsRef }: { levelsRef: React.MutableRefObject<number[]> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const BARS = 40;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const levels = levelsRef.current;
      const barW = (w / BARS) * 0.5;
      const gap = (w / BARS) * 0.5;
      const mid = h / 2;

      for (let i = 0; i < BARS; i++) {
        // espejo desde el centro para efecto simétrico tipo "ok google"
        const dist = Math.abs(i - BARS / 2) / (BARS / 2);
        const lvl = levels[i] ?? 0;
        const amp = lvl * (1 - dist * 0.5);
        const barH = Math.max(barW, amp * h * 0.9);
        const x = i * (barW + gap) + gap / 2;

        const grad = ctx.createLinearGradient(0, mid - barH / 2, 0, mid + barH / 2);
        grad.addColorStop(0, "#C6FF6B");
        grad.addColorStop(0.5, FLOW);
        grad.addColorStop(1, "#9BBF00");
        ctx.fillStyle = grad;

        ctx.beginPath();
        const r = barW / 2;
        const y = mid - barH / 2;
        ctx.roundRect(x, y, barW, barH, r);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [levelsRef]);

  return <canvas ref={canvasRef} className="w-full h-24" />;
}

// ── Reveal: arma la oración con el resultado YA parseado (no transcripción en
// vivo — Web Speech API no es confiable en WebView de Android). El monto y la
// categoría hacen "pop" porque ya se conocen, luego se asienta en una fila de
// confirmación antes de avisarle al padre que ya puede abrir el EntrySheet. ──
function RevealLine({
  tx,
  formatAmount,
  onDone,
}: {
  tx: ParsedVoiceTx;
  formatAmount: (n: number) => string;
  onDone: () => void;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [settled, setSettled] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Mismos pares expense-ink/income-ink (light/dark) ya documentados y usados en
  // entry-sheet.tsx — se lee una sola vez porque el overlay es de vida corta,
  // no hace falta reaccionar a un cambio de theme a mitad de una grabación.
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  useEffect(() => {
    let cancelled = false;
    const el = lineRef.current;
    const cursor = cursorRef.current;
    if (!el || !cursor) return;
    el.innerHTML = "";
    el.appendChild(cursor);
    cursor.style.opacity = "1";

    const amountStyle =
      tx.type === "expense"
        ? (isDark ? { background: "rgba(248,113,113,0.22)", color: "#FFA3A3" } : { background: "rgba(220,38,38,0.14)", color: "#7F1D1D" })
        : (isDark ? { background: "rgba(110,231,183,0.20)", color: "#6EE7B7" } : { background: "rgba(0,168,112,0.16)", color: "#00432C" });
    const categoryStyle = isDark ? { background: "rgba(167,139,250,0.22)", color: "#C4B5FD" } : { background: "#E9E4FF", color: "#5B3DE0" };

    type Token = { text: string; tag?: "amount" | "category" };
    const tokens: Token[] = [];
    if (tx.description) {
      tokens.push({ text: `${tx.description} ` });
      tokens.push({ text: "— " });
    }
    tokens.push({ text: formatAmount(tx.amount), tag: "amount" });
    if (tx.categoryName) {
      tokens.push({ text: " · " });
      tokens.push({ text: tx.categoryName, tag: "category" });
    }

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    (async () => {
      for (const token of tokens) {
        if (cancelled) return;
        if (token.tag) {
          const pill = document.createElement("span");
          pill.textContent = token.text;
          pill.style.display = "inline-block";
          pill.style.borderRadius = "8px";
          pill.style.padding = "1px 8px";
          pill.style.fontWeight = "800";
          pill.style.transform = "scale(0)";
          pill.style.transition = "transform 0.35s cubic-bezier(.2,.8,.2,1)";
          Object.assign(pill.style, token.tag === "amount" ? amountStyle : categoryStyle);
          el.insertBefore(pill, cursor);
          requestAnimationFrame(() => { pill.style.transform = "scale(1)"; });
          await sleep(145);
        } else {
          for (const ch of token.text) {
            if (cancelled) return;
            const span = document.createElement("span");
            span.textContent = ch;
            el.insertBefore(span, cursor);
            await sleep(22);
          }
        }
      }
      if (cancelled) return;
      await sleep(200);
      cursor.style.opacity = "0";
      await sleep(280);
      if (cancelled) return;
      setSettled(true);
      await sleep(880);
      if (!cancelled) onDoneRef.current();
    })();

    return () => { cancelled = true; };
  }, [tx, formatAmount, isDark]);

  return (
    <div className="w-full">
      <div ref={lineRef} className="min-h-[4.4em] text-[1.4rem] font-semibold leading-snug" style={{ color: INK }}>
        <span
          ref={cursorRef}
          className="inline-block h-[1.05em] w-[3px] align-[-0.15em]"
          style={{ background: INK, animation: "ff-caret-blink 1s steps(1) infinite" }}
        />
      </div>
      <div
        className="mt-2 flex items-center justify-between pt-4 transition-all duration-500"
        style={{
          borderTop: "1px solid hsl(var(--foreground) / 0.1)",
          opacity: settled ? 1 : 0,
          transform: settled ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: FLOW }}>
            <Check className="h-3 w-3" style={{ color: FLOW_INK }} strokeWidth={3} />
          </div>
          <span className="text-sm font-bold" style={{ color: INK }}>
            {tx.description || tx.categoryName || "Transaction"}
            {tx.categoryName && tx.description && (
              <span className="font-medium" style={{ color: "hsl(var(--foreground) / 0.5)" }}> · {tx.categoryName}</span>
            )}
          </span>
        </div>
        <span className="text-xl font-extrabold" style={{ color: tx.type === "expense" ? (isDark ? "#FFA3A3" : "#C0392B") : (isDark ? "#6EE7B7" : "#00A870") }}>
          {tx.type === "expense" ? "−" : "+"}{formatAmount(tx.amount)}
        </span>
      </div>
    </div>
  );
}

export default function VoiceCapture({
  onClose,
  onParsed,
}: {
  onClose: () => void;
  onParsed: (tx: ParsedVoiceTx) => void;
}) {
  const { currency, formatAmount } = useCurrency();
  const [phase, setPhase] = useState<Phase>("listening");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ParsedVoiceTx | null>(null);

  const levelsRef = useRef<number[]>(new Array(40).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const silenceStartRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const stoppedRef = useRef(false);
  const closedRef = useRef(false);
  const heardRef = useRef(false);
  const [runId, setRunId] = useState(0);

  // Bloquea el scroll/swipe de fondo mientras el overlay está montado —
  // mismo patrón que EntrySheet, así el swipe entre páginas del nav no lo confunde con esto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const stopEverything = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try { mediaRecorderRef.current?.state !== "inactive" && mediaRecorderRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve((r.result as string).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  const sendAudio = useCallback(async (blob: Blob, mimeType: string) => {
    if (closedRef.current) return;
    setPhase("processing");
    try {
      const audio = await blobToBase64(blob);
      const { data } = await supabase.auth.getSession();
      const res = await fetch(getApiUrl("/api/voice/parse"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: JSON.stringify({ audio, mimeType, currency }),
      });
      const parsed = await res.json();
      if (closedRef.current) return;
      if (!res.ok) { setError(parsed?.error || "I couldn't understand that."); setPhase("error"); return; }
      // Si no captó monto ni categoría, tratarlo como "no reconocido" y ofrecer reintento
      if (!(parsed?.amount > 0) && parsed?.categoryId == null && !parsed?.description) {
        setError("I couldn't make out a transaction. Try again, a bit slower.");
        setPhase("error");
        return;
      }
      setResult(parsed as ParsedVoiceTx);
      setPhase("revealing");
    } catch {
      if (closedRef.current) return;
      setError("Couldn't reach the server. Try again.");
      setPhase("error");
    }
  }, [currency]);

  const handleStop = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    } else {
      // Tocó "Done" antes de que se detectara alguna palabra — el recorder
      // nunca arrancó (ver tick()), así que mr.onstop no se va a disparar solo.
      stopEverything();
      if (!closedRef.current) { setError("I didn't hear anything. Tap to try again."); setPhase("error"); }
    }
  }, [stopEverything]);

  useEffect(() => {
    let mounted = true;
    stoppedRef.current = false;
    silenceStartRef.current = null;
    heardRef.current = false;
    (async () => {
      try {
        // Constraints explícitas: sin esto, Android WebView no aplica supresión de
        // ruido de forma confiable — el ruido de fondo se mantenía sobre el umbral
        // de "silencio" y el auto-stop nunca se disparaba (por eso se sentía lento
        // Y agarraba ruido de al lado: eran la misma causa).
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        // Analizador para el waveform + detección de silencio
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;
        // El RMS de detección de voz solo mira las bins de ~4kHz para abajo
        // (donde vive el habla) — promediar todo el espectro (fftSize chico,
        // 64 bins) diluía la energía real de la voz con bins agudas casi
        // silenciosas, y eso hacía que voces más graves o suaves nunca
        // cruzaran SPEECH_THRESHOLD y quedaran como "didn't catch that".
        const voiceBinCount = Math.min(
          analyser.frequencyBinCount,
          Math.max(1, Math.ceil((4000 * analyser.fftSize) / audioCtx.sampleRate))
        );

        // Grabadora
        const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        mediaRecorderRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          stopEverything();
          if (closedRef.current) return;
          if (!heardRef.current) { setError("I didn't hear anything. Tap to try again."); setPhase("error"); return; }
          const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
          if (blob.size > 0) sendAudio(blob, mime || "audio/webm");
          else { setError("I didn't hear anything. Tap to try again."); setPhase("error"); }
        };
        // OJO: mr.start() se dispara recién cuando se detecta la primera palabra
        // real (ver tick() abajo) — así no grabamos ni mandamos el "aire" previo
        // (ruido ambiente) antes de que la persona empiece a hablar.

        // Loop de análisis: volumen → barras + silencio
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          // RMS aproximado — solo sobre el rango de voz (ver voiceBinCount arriba)
          let sum = 0;
          for (let i = 0; i < voiceBinCount; i++) { const v = data[i] / 255; sum += v * v; }
          const rms = Math.sqrt(sum / voiceBinCount);

          // Actualiza barras: desplaza e inserta el nivel nuevo
          const levels = levelsRef.current;
          for (let i = 0; i < levels.length - 1; i++) levels[i] = levels[i + 1];
          levels[levels.length - 1] = Math.min(1, rms * 2.4);

          const now = Date.now();

          // Marca cuando el usuario EMPIEZA a hablar — recién ahí arranca la
          // grabación real y el timer, para no mandar el silencio/ruido previo.
          if (!heardRef.current && rms > SPEECH_THRESHOLD) {
            heardRef.current = true;
            startedAtRef.current = now;
            try { if (mr.state === "inactive") mr.start(); } catch {}
          }

          if (heardRef.current) setElapsed(Math.floor((now - startedAtRef.current) / 1000));

          // Auto-stop solo DESPUES de que haya hablado (no cuenta el silencio inicial)
          if (heardRef.current) {
            if (rms < SILENCE_THRESHOLD) {
              if (silenceStartRef.current == null) silenceStartRef.current = now;
              else if (now - silenceStartRef.current > SILENCE_MS) { handleStop(); return; }
            } else {
              silenceStartRef.current = null;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError("Microphone permission denied.");
        setPhase("error");
      }
    })();

    return () => { mounted = false; stopEverything(); };
  }, [sendAudio, stopEverything, handleStop, runId]);

  const restart = () => {
    closedRef.current = false;
    stoppedRef.current = false;
    silenceStartRef.current = null;
    heardRef.current = false;
    setError("");
    setElapsed(0);
    setResult(null);
    levelsRef.current = levelsRef.current.map(() => 0);
    setPhase("listening");
    setRunId((n) => n + 1);
  };

  const close = () => { closedRef.current = true; stopEverything(); onClose(); };

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center px-6 animate-in fade-in duration-300"
      style={{ background: PAPER }}
    >
      {/* Cerrar */}
      <button
        onClick={close}
        className="absolute flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)", right: 16, background: "hsl(var(--foreground) / 0.06)" }}
      >
        <X className="h-4 w-4" style={{ color: "hsl(var(--foreground) / 0.55)" }} />
      </button>

      {(phase === "listening" || phase === "processing") && (
        <div className="flex w-full max-w-sm flex-col items-center duration-300 animate-in fade-in zoom-in-95">
          <div className="mb-6 flex items-center gap-2.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full"
                style={{ background: "hsl(var(--foreground) / 0.15)", animation: `ff-dot-breathe 1.4s ease-in-out ${i * 0.16}s infinite` }}
              />
            ))}
          </div>

          <p className="mb-8 px-4 text-center text-sm" style={{ color: "hsl(var(--foreground) / 0.55)" }}>
            {phase === "listening"
              ? <>Say something like <span style={{ color: INK, opacity: 0.85 }}>"spent 50 on lunch"</span></>
              : "Reading your transaction…"}
          </p>

          {phase === "listening" && (
            <>
              <div className="mb-8 w-full"><Waveform levelsRef={levelsRef} /></div>
              <div className="flex flex-col items-center gap-4">
                <span className="text-xs tabular-nums" style={{ color: "hsl(var(--foreground) / 0.4)" }}>
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                </span>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 rounded-full px-6 py-3 font-bold transition-transform active:scale-95"
                  style={{ background: INK, color: PAPER }}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "revealing" && result && (
        <div className="w-full max-w-sm duration-300 animate-in fade-in">
          <RevealLine tx={result} formatAmount={formatAmount} onDone={() => onParsed(result)} />
        </div>
      )}

      {phase === "error" && (
        <div className="flex max-w-xs flex-col items-center text-center duration-300 animate-in fade-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
            <Mic className="h-8 w-8" style={{ color: "hsl(var(--foreground) / 0.4)" }} />
          </div>
          <p className="mb-1 text-lg font-bold" style={{ color: INK }}>Didn't catch that</p>
          <p className="mb-6 text-sm" style={{ color: "hsl(var(--foreground) / 0.55)" }}>{error}</p>
          <div className="flex items-center gap-2.5">
            <button onClick={close} className="rounded-2xl px-5 py-2.5 font-bold" style={{ background: "hsl(var(--foreground) / 0.08)", color: INK }}>
              Cancel
            </button>
            <button onClick={restart} className="flex items-center gap-2 rounded-2xl px-5 py-2.5 font-bold" style={{ background: FLOW, color: FLOW_INK }}>
              <Mic className="h-4 w-4" strokeWidth={2.5} />
              Try again
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
