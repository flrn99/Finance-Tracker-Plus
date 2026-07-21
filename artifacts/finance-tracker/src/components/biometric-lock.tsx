import { useEffect, useRef, useState } from "react";
import { Fingerprint, Trash2 } from "lucide-react";
import { useBiometric, verifyPin } from "@/lib/biometric-context";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";

// Reintenta una vez en silencio antes de caer a PIN — nunca hace falta tocar
// "Try Again": si el primer toque de biometría falla, se reintenta solo tras
// RETRY_DELAY_MS; si el segundo también falla, pasa a PIN solo tras SWITCH_DELAY_MS.
// El delay entre intentos es a propósito (no instantáneo): relanzar el prompt
// nativo de biometría pegado al anterior se siente como un parpadeo, no como
// un reintento — y le da tiempo al toast a leerse.
const RETRY_DELAY_MS = 700;
const SWITCH_DELAY_MS = 900;

// 🚀 CACHÉ DE HAPTICS (Optimización de velocidad)
let hapticsModule: any = null;
const triggerHaptic = () => {
  if (hapticsModule) {
    hapticsModule.Haptics.impact({ style: hapticsModule.ImpactStyle.Light }).catch(() => {});
  } else {
    import("@capacitor/haptics").then(mod => {
      hapticsModule = mod;
      mod.Haptics.impact({ style: mod.ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
  }
};

export default function BiometricLock() {
  const { triggerAuth, unlock } = useBiometric();
  const [mode, setMode] = useState<"biometric" | "pin">("biometric");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const didAutoTrigger = useRef(false);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evita que un tap/click dispare la acción dos veces (pointerdown + click sintético),
  // pero deja pasar el click "puro" que llega de Enter/Espacio por teclado (sin pointerdown antes).
  const firedByPointer = useRef(false);

  const clearRetryTimer = () => {
    if (retryTimeout.current) { clearTimeout(retryTimeout.current); retryTimeout.current = null; }
  };

  // attemptIndex 0 = primer intento (al montar), 1 = el reintento silencioso.
  // Nunca hay un botón "Try Again": si falla, esta misma función se reprograma sola.
  const runBiometricAttempt = async (attemptIndex: number) => {
    const success = await triggerAuth();
    if (success) return; // unlock() ya lo dispara el context

    if (attemptIndex === 0) {
      setToast("Retrying automatically");
      retryTimeout.current = setTimeout(() => {
        setToast("");
        runBiometricAttempt(1);
      }, RETRY_DELAY_MS);
    } else {
      setToast("Switched to PIN — automatic");
      retryTimeout.current = setTimeout(() => {
        setToast("");
        setMode("pin");
      }, SWITCH_DELAY_MS);
    }
  };

  useEffect(() => {
    if (didAutoTrigger.current) return;
    didAutoTrigger.current = true;
    runBiometricAttempt(0);
    return clearRetryTimer;
  }, []);

  // Escape hatch manual — salta a PIN sin esperar a que el segundo intento falle solo.
  const skipToPin = () => {
    clearRetryTimer();
    setToast("");
    setMode("pin");
  };

  // Desde PIN, volver a intentar biometría a propósito reinicia la secuencia entera.
  const retryBiometric = () => {
    clearRetryTimer();
    setToast("");
    setError("");
    setPin("");
    setMode("biometric");
    runBiometricAttempt(0);
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError("");

    if (newPin.length === 6) {
      verifyPin(newPin).then((ok) => {
        if (ok) {
          unlock();
          return;
        }
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
          setError("Incorrect PIN. Try again.");
        }, 500);
      });
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const DIGITS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Flow!"
      className="fixed inset-0 z-[999] flex flex-col items-center px-5 animate-in fade-in duration-500 overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        backgroundColor: "hsl(var(--background))",
      }}
    >
      {/* Resplandor único — ciclando los mismos 4 colores que antes vivían en el glow
          de la card (Flow Green → Cyan → Violeta → Menta), ahora como el fondo entero.
          Nada de mesh de 4 esquinas ni card flotante: quiere acompañar al diálogo
          nativo de biometría de Android/Samsung, no competirle. */}
      <div
        aria-hidden="true"
        className="ff-bg-glow absolute pointer-events-none"
        style={{
          width: 380,
          height: 380,
          borderRadius: "9999px",
          left: "50%",
          top: "8%",
          transform: "translate(-50%, -40%)",
          filter: "blur(70px)",
        }}
      />
      <style>{`
        @keyframes ff-bg-glow {
          0%   { background: rgba(168,255,62,0.28); }
          25%  { background: rgba(34,211,238,0.26); }
          50%  { background: rgba(167,139,250,0.26); }
          75%  { background: rgba(52,211,153,0.24); }
          100% { background: rgba(168,255,62,0.28); }
        }
        .ff-bg-glow { animation: ff-bg-glow 10s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ff-bg-glow { animation: none !important; background: rgba(168,255,62,0.22) !important; }
        }
        @keyframes ff-fp-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.7; }
        }
        .ff-fp-pulse { animation: ff-fp-pulse 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ff-fp-pulse { animation: none; } }

        /* Molded — cápsula prensada del mismo color que el fondo, sombras dobles
           tintadas con los mismos 4 colores del glow (cicla en fase con .ff-bg-glow,
           misma duración) para que se sienta "hecha de la luz" que tiene atrás, no
           puesta encima. La luz clara (highlight) es casi invisible en dark porque
           un blanco fuerte ahí se ve pegado/falso sobre un fondo casi negro. */
        .ff-capsule {
          --ff-capsule-highlight: rgba(255,255,255,0.6);
          background: hsl(var(--background));
          animation: ff-capsule-glow 10s ease-in-out infinite;
        }
        .dark .ff-capsule { --ff-capsule-highlight: rgba(255,255,255,0.04); }
        @keyframes ff-capsule-glow {
          0%   { box-shadow: -6px -6px 14px var(--ff-capsule-highlight), 6px 8px 20px rgba(168,255,62,0.22); }
          25%  { box-shadow: -6px -6px 14px var(--ff-capsule-highlight), 6px 8px 20px rgba(34,211,238,0.20); }
          50%  { box-shadow: -6px -6px 14px var(--ff-capsule-highlight), 6px 8px 20px rgba(167,139,250,0.20); }
          75%  { box-shadow: -6px -6px 14px var(--ff-capsule-highlight), 6px 8px 20px rgba(52,211,153,0.18); }
          100% { box-shadow: -6px -6px 14px var(--ff-capsule-highlight), 6px 8px 20px rgba(168,255,62,0.22); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ff-capsule { animation: none; box-shadow: -6px -6px 14px var(--ff-capsule-highlight), 6px 8px 20px rgba(168,255,62,0.2); }
        }
        .ff-key {
          background: hsl(var(--background));
          box-shadow: -3px -3px 6px var(--ff-capsule-highlight), 3px 4px 8px rgba(0,0,0,0.1);
        }
        .ff-key:active { box-shadow: inset -2px -2px 5px var(--ff-capsule-highlight), inset 2px 3px 6px rgba(0,0,0,0.12); }

        /* PIN shake — "animate-shake" no existe como utility real en el proyecto
           (ni Tailwind ni tw-animate-css la definen), así que el shake de un PIN
           incorrecto nunca se veía. Reemplazado por esta clase local. */
        @keyframes ff-pin-shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
        .ff-pin-shake { animation: ff-pin-shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @media (prefers-reduced-motion: reduce) { .ff-pin-shake { animation: none; } }
      `}</style>

      {/* Logo — chico y quieto a propósito: esta pantalla se ve muchas veces por
          día, así que es más ancla de "esta es tu app de verdad" que momento de
          marca. Antes medía 72px (tamaño de splash), bajado a 40px. */}
      <div className="relative z-10 mt-16 flex items-center justify-center">
        <LogoMark height={40} />
      </div>

      <div className="flex-1" />

      {/* Una sola cápsula — en reposo espera la biometría; si hace falta PIN,
          la MISMA cápsula crece para contenerlo en vez de reemplazar la pantalla
          entera. overflow-hidden a propósito: durante la transición de altura,
          recorta el contenido de PIN que ya está montado debajo (revela, no tapa). */}
      <div
        className="ff-capsule relative z-10 w-full max-w-[280px] rounded-[28px] overflow-hidden flex flex-col items-center transition-[height] duration-500 ease-out"
        style={{ height: mode === "pin" ? 432 : 152 }}
      >
        {toast && (
          <p role="status" aria-live="polite" className="mt-4 text-[11px] font-bold px-3 py-1.5 rounded-full bg-foreground text-background animate-in fade-in duration-200">
            {toast}
          </p>
        )}

        {mode === "biometric" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2.5 animate-in fade-in duration-300">
            <Fingerprint className="ff-fp-pulse h-7 w-7 text-foreground/80" strokeWidth={1.75} />
            <p className="text-sm font-semibold text-muted-foreground">Verifying…</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-3 px-5 pt-5 pb-4 animate-in fade-in duration-300">
            <p className="text-lg font-bold tracking-tight text-foreground">Enter PIN</p>

            {error && (
              <p role="alert" className="text-xs font-bold text-[#E11D48] dark:text-[#FFA3A3] text-center animate-in fade-in duration-200">{error}</p>
            )}

            {/* PIN dots — el progreso real se anuncia aparte */}
            <div aria-hidden="true" className={cn("flex gap-3 py-1 justify-center items-center h-4", shake && "ff-pin-shake")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-150 ease-out will-change-transform"
                  style={{
                    background: i < pin.length ? "currentColor" : "transparent",
                    border: "1.5px solid currentColor",
                    opacity: i < pin.length ? 1 : 0.25,
                    transform: i < pin.length ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
            </div>
            <span className="sr-only" aria-live="polite">{pin.length} of 6 digits entered</span>

            <div className="grid grid-cols-3 gap-3 w-full max-w-[220px] mx-auto pb-1">
              {DIGITS.flat().map((digit, i) => {
                if (digit === "") return <div key={i} />;
                if (digit === "del") return (
                  <button
                    key={i}
                    aria-label="Delete"
                    onPointerDown={(e) => { e.preventDefault(); firedByPointer.current = true; triggerHaptic(); handleDelete(); }}
                    onClick={() => {
                      if (firedByPointer.current) { firedByPointer.current = false; return; }
                      triggerHaptic();
                      handleDelete();
                    }}
                    disabled={pin.length === 0}
                    className="ff-key relative h-14 w-14 rounded-full mx-auto flex items-center justify-center overflow-hidden transition-all duration-100 ease-out disabled:opacity-20 shrink-0 will-change-transform"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Trash2 className="relative z-10 h-5 w-5 text-foreground/90" />
                  </button>
                );
                return (
                  <button
                    key={i}
                    onPointerDown={(e) => { e.preventDefault(); firedByPointer.current = true; triggerHaptic(); handlePinDigit(digit); }}
                    onClick={() => {
                      if (firedByPointer.current) { firedByPointer.current = false; return; }
                      triggerHaptic();
                      handlePinDigit(digit);
                    }}
                    disabled={pin.length >= 6}
                    className="ff-key relative h-14 w-14 rounded-full mx-auto flex items-center justify-center overflow-hidden transition-all duration-100 ease-out disabled:opacity-20 shrink-0 will-change-transform"
                    style={{ touchAction: "manipulation", fontFeatureSettings: "'tnum' on" }}
                  >
                    <span className="relative z-10 text-[20px] font-medium tracking-tight text-foreground/90">{digit}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="relative z-10 mb-8">
        {mode === "biometric" ? (
          <button
            onClick={skipToPin}
            className="h-11 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/60 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          >
            Use PIN instead
          </button>
        ) : (
          <button
            onClick={retryBiometric}
            className="h-11 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          >
            Use biometrics instead
          </button>
        )}
      </div>
    </div>
  );
}
