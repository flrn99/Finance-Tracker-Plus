import { useEffect, useRef, useState } from "react";
import { Trash2, ShieldAlert } from "lucide-react";
import { useBiometric, verifyPin } from "@/lib/biometric-context";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";

const MAX_ATTEMPTS = 3;

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
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [shake, setShake] = useState(false);
  const didAutoTrigger = useRef(false);
  // Evita que un tap/click dispare la acción dos veces (pointerdown + click sintético),
  // pero deja pasar el click "puro" que llega de Enter/Espacio por teclado (sin pointerdown antes).
  const firedByPointer = useRef(false);

  // Auto-trigger biometric on mount
  useEffect(() => {
    if (didAutoTrigger.current) return;
    didAutoTrigger.current = true;
    handleBiometric();
  }, []);

  const handleBiometric = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setError("");
    const success = await triggerAuth();
    setIsAuthenticating(false);
    if (!success) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setMode("pin");
        setError("Too many failed attempts. Enter your backup PIN.");
      } else {
        setError(`Authentication failed. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`);
      }
    }
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
        @keyframes ff-dot-wave {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        .ff-dot { animation: ff-dot-wave 1.4s ease-in-out infinite; }
      `}</style>

      {/* Logo — antes era un <img> crudo con el padding transparente de logo.png
          intacto (mismo problema que login.tsx tenía y se arregló con LogoMark:
          el glifo real ocupa solo ~50% de la altura del PNG, así que se veía
          chico y encima ese padding invisible se sumaba al margen de abajo). */}
      <div className="relative z-10 mt-14 flex items-center justify-center">
        <LogoMark height={72} />
      </div>

      {mode === "biometric" ? (
        isAuthenticating ? (
          /* El prompt nativo de Android está arriba en este momento — el centro de
             la pantalla queda vacío a propósito, es donde cae su card. Nada de
             ícono ni título compitiendo con eso. */
          <>
            <div className="relative z-10 mt-4 flex flex-col items-center gap-2.5">
              <p className="text-sm font-semibold text-muted-foreground">Waiting for verification…</p>
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="ff-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => { setMode("pin"); setError(""); }}
              className="relative z-10 mb-10 h-11 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/60 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
            >
              Use PIN instead
            </button>
          </>
        ) : (
          /* El prompt nativo se cerró (todavía no arrancó, o falló) — acá sí tenemos
             toda la pantalla para nosotros. */
          <>
            <div className="flex-1" />
            <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-[280px] mb-10 animate-in fade-in zoom-in-95 duration-300">
              <div className="text-center space-y-1.5">
                <p className="text-xl font-bold tracking-tight text-foreground">Verify Identity</p>
                <p className="text-sm font-medium text-muted-foreground">Use Face ID or fingerprint to unlock</p>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2.5 bg-destructive/10 text-destructive rounded-2xl px-4 py-3.5 w-full">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <p className="text-xs font-semibold leading-tight">{error}</p>
                </div>
              )}

              <button
                onClick={handleBiometric}
                disabled={isAuthenticating}
                className="w-full py-4 rounded-2xl font-bold text-black active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center"
                style={{ background: "#CAFA01", boxShadow: "0 4px 14px rgba(168,255,62,0.3), inset 0 1px 1px rgba(255,255,255,0.4)" }}
              >
                Try Again
              </button>

              <button
                onClick={() => { setMode("pin"); setError(""); }}
                className="h-11 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                Use PIN instead
              </button>
            </div>
          </>
        )
      ) : (
        /* PIN — nunca lo tapa el sistema, vive centrado sin restricciones */
        <>
          <div className="flex-1" />
          <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-[280px] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-1.5">
              <p className="text-xl font-bold tracking-tight text-foreground">Enter PIN</p>
              <p className="text-sm font-medium text-muted-foreground">Enter your 6-digit security PIN</p>
            </div>

            {/* 💎 PIN dots — el progreso real se anuncia aparte */}
            <div aria-hidden="true" className={cn("flex gap-3 py-2 justify-center items-center h-4", shake && "animate-shake")}>
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

            {error && (
              <p role="alert" className="text-xs font-bold text-[#E11D48] dark:text-[#FFA3A3] text-center animate-in fade-in duration-200">{error}</p>
            )}

            <div className="grid grid-cols-3 gap-4 w-full max-w-[220px] mx-auto pb-1">
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
                    className="relative h-14 w-14 rounded-full mx-auto flex items-center justify-center overflow-hidden active:scale-[0.88] transition-transform duration-75 ease-out disabled:opacity-20 shrink-0 bg-black/[0.03] dark:bg-white/[0.04] active:bg-black/[0.08] dark:active:bg-white/[0.1] will-change-transform"
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
                    className="relative h-14 w-14 rounded-full mx-auto flex items-center justify-center overflow-hidden active:scale-[0.88] transition-transform duration-75 ease-out disabled:opacity-20 shrink-0 bg-black/[0.03] dark:bg-white/[0.04] active:bg-black/[0.08] dark:active:bg-white/[0.1] will-change-transform"
                    style={{ touchAction: "manipulation", fontFeatureSettings: "'tnum' on" }}
                  >
                    <span className="relative z-10 text-[22px] font-medium tracking-tight text-foreground/90">{digit}</span>
                  </button>
                );
              })}
            </div>

            {attempts < MAX_ATTEMPTS && (
              <button
                onClick={() => { setMode("biometric"); setError(""); setPin(""); handleBiometric(); }}
                className="h-11 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                Use biometrics instead
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
