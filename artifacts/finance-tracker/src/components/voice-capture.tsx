import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Mic, X, Loader2, Check } from "lucide-react";
import { getApiUrl } from "@/lib/api-config";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/lib/currency-context";

const FLOW = "#A8FF3E";
const SILENCE_MS = 2000;        // auto-stop tras 2s de silencio
const SILENCE_THRESHOLD = 0.045; // nivel de volumen considerado "silencio"
const MIN_SPEECH_MS = 700;       // no auto-parar antes de que hable

export interface ParsedVoiceTx {
  amount: number;
  type: "expense" | "income";
  categoryId: number | null;
  categoryName: string | null;
  description: string;
}

type Phase = "listening" | "processing" | "error";

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
        grad.addColorStop(1, "#7DD900");
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

  return <canvas ref={canvasRef} className="w-full h-28" />;
}

export default function VoiceCapture({
  onClose,
  onParsed,
}: {
  onClose: () => void;
  onParsed: (tx: ParsedVoiceTx) => void;
}) {
  const { currency } = useCurrency();
  const [phase, setPhase] = useState<Phase>("listening");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

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
      const result = await res.json();
      if (!res.ok) { setError(result?.error || "Something went wrong."); setPhase("error"); return; }
      onParsed(result as ParsedVoiceTx);
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPhase("error");
    }
  }, [currency, onParsed]);

  const handleStop = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        // Analizador para el waveform + detección de silencio
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Grabadora
        const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        mediaRecorderRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          stopEverything();
          const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
          if (blob.size > 0) sendAudio(blob, mime || "audio/webm");
          else { setError("No audio captured."); setPhase("error"); }
        };
        mr.start();
        startedAtRef.current = Date.now();

        // Loop de análisis: volumen → barras + silencio
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          // RMS aproximado
          let sum = 0;
          for (let i = 0; i < data.length; i++) { const v = data[i] / 255; sum += v * v; }
          const rms = Math.sqrt(sum / data.length);

          // Actualiza barras: desplaza e inserta el nivel nuevo
          const levels = levelsRef.current;
          for (let i = 0; i < levels.length - 1; i++) levels[i] = levels[i + 1];
          levels[levels.length - 1] = Math.min(1, rms * 2.4);

          const now = Date.now();
          setElapsed(Math.floor((now - startedAtRef.current) / 1000));

          // Auto-stop por silencio (tras un mínimo de habla)
          if (now - startedAtRef.current > MIN_SPEECH_MS) {
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
  }, [sendAudio, stopEverything, handleStop]);

  const close = () => { stopEverything(); onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center px-6 animate-in fade-in duration-300"
      style={{ background: "rgba(8,10,6,0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>

      {/* Cerrar */}
      <button onClick={close} className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.08)" }}>
        <X className="h-5 w-5 text-white/70" />
      </button>

      {phase === "listening" && (
        <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
          {/* Halo pulsante detrás del mic */}
          <div className="relative mb-8 flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full animate-ping" style={{ background: `${FLOW}22` }} />
            <div className="absolute w-24 h-24 rounded-full" style={{ background: `${FLOW}18` }} />
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ background: FLOW }}>
              <Mic className="h-7 w-7 text-black" />
            </div>
          </div>

          <p className="text-white font-serif font-bold text-xl mb-1">Listening…</p>
          <p className="text-white/50 text-sm mb-6 text-center px-4">
            Say something like <span className="text-white/80">"spent 50 on lunch"</span>
          </p>

          {/* Waveform */}
          <div className="w-full mb-6"><Waveform levelsRef={levelsRef} /></div>

          {/* Timer + stop manual */}
          <div className="flex flex-col items-center gap-4">
            <span className="text-white/40 text-xs tabular-nums">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
            <button onClick={handleStop}
              className="px-6 py-3 rounded-full font-bold text-black active:scale-95 transition-transform flex items-center gap-2"
              style={{ background: FLOW }}>
              <Check className="h-4 w-4" strokeWidth={3} />
              Done
            </button>
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="flex flex-col items-center animate-in fade-in duration-300">
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full animate-ping" style={{ background: `${FLOW}22` }} />
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: FLOW }} />
          </div>
          <p className="text-white font-serif font-bold text-lg">Understanding…</p>
          <p className="text-white/50 text-sm mt-1">Reading your transaction</p>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col items-center text-center animate-in fade-in duration-300 max-w-xs">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,59,59,0.15)" }}>
            <X className="h-8 w-8 text-[#FF5C5C]" />
          </div>
          <p className="text-white font-bold text-lg mb-1">Didn't catch that</p>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <button onClick={close} className="px-6 py-3 rounded-full font-bold text-black" style={{ background: FLOW }}>
            Try again
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
