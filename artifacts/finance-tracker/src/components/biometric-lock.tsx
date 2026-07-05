import { useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, Trash2, ShieldAlert } from "lucide-react";
import { useBiometric, getStoredPin } from "@/lib/biometric-context";
import { cn } from "@/lib/utils";

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
  const [logoOk, setLogoOk] = useState(true);

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
      const stored = getStoredPin();
      if (newPin === stored) {
        unlock();
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin("");
          setError("Incorrect PIN. Try again.");
        }, 500);
      }
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
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center px-5 animate-in fade-in duration-500 overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        backgroundColor: "hsl(var(--background))",
      }}
    >
      {/* 🌈 Aurora mesh — blobs difuminados a la deriva */}
      <style>{`
        @keyframes ff-drift-1 { from { transform: translate(0,0) scale(1); } to { transform: translate(9vmin,7vmin) scale(1.12); } }
        @keyframes ff-drift-2 { from { transform: translate(0,0) scale(1.05); } to { transform: translate(-8vmin,5vmin) scale(0.95); } }
        @keyframes ff-drift-3 { from { transform: translate(0,0) scale(0.95); } to { transform: translate(6vmin,-8vmin) scale(1.1); } }
        @keyframes ff-drift-4 { from { transform: translate(0,0) scale(1.08); } to { transform: translate(-6vmin,-5vmin) scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .ff-blob { animation: none !important; }
        }
      `}</style>
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="ff-blob absolute rounded-full"
          style={{
            width: "72vmin", height: "72vmin", top: "-18%", left: "-18%",
            background: "#A8FF3E", opacity: 0.8, filter: "blur(60px)",
            animation: "ff-drift-1 16s ease-in-out infinite alternate",
          }}
        />
        <div
          className="ff-blob absolute rounded-full"
          style={{
            width: "60vmin", height: "60vmin", top: "22%", right: "-22%",
            background: "#22D3EE", opacity: 0.7, filter: "blur(60px)",
            animation: "ff-drift-2 20s ease-in-out infinite alternate",
          }}
        />
        <div
          className="ff-blob absolute rounded-full"
          style={{
            width: "58vmin", height: "58vmin", bottom: "-16%", left: "2%",
            background: "#A78BFA", opacity: 0.7, filter: "blur(65px)",
            animation: "ff-drift-3 18s ease-in-out infinite alternate",
          }}
        />
        <div
          className="ff-blob absolute rounded-full"
          style={{
            width: "46vmin", height: "46vmin", bottom: "8%", right: "6%",
            background: "#34D399", opacity: 0.65, filter: "blur(60px)",
            animation: "ff-drift-4 22s ease-in-out infinite alternate",
          }}
        />
      </div>

      {/* 💳 Card flotante limpia */}
      <div
        className="relative w-full max-w-[310px] rounded-[2rem] bg-card px-5 pt-7 pb-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-500"
        style={{
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid hsl(var(--foreground) / 0.05)",
          marginBottom: "10vh",
        }}
      >
        {/* Icon & Title */}
        <div className="mb-6 flex flex-col items-center gap-3.5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.05)]"
            style={{
              background: mode === "biometric"
                ? "linear-gradient(135deg, rgba(124,58,255,0.15), rgba(124,58,255,0.05))"
                : "linear-gradient(135deg, rgba(168,255,62,0.18), rgba(168,255,62,0.05))",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {mode === "biometric"
              ? <Fingerprint className="h-10 w-10 text-[#7C3AFF] drop-shadow-sm" />
              : <KeyRound className="h-10 w-10 text-foreground drop-shadow-sm" />
            }
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {mode === "biometric" ? "Verify Identity" : "Enter PIN"}
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {mode === "biometric"
                ? "Use Face ID or fingerprint to unlock"
                : "Enter your 6-digit security PIN"
              }
            </p>
          </div>
        </div>

        {/* Dynamic Content based on Mode */}
        <div className="w-full relative min-h-[280px] flex flex-col items-center justify-start">

          {mode === "biometric" ? (
            <div className="flex flex-col items-center gap-5 w-full animate-in fade-in zoom-in-95 duration-300">
              {error && (
                <div className="flex items-center gap-2.5 bg-destructive/10 text-destructive rounded-[20px] px-4 py-3.5 w-full">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <p className="text-xs font-semibold leading-tight">{error}</p>
                </div>
              )}

              <button
                onClick={handleBiometric}
                disabled={isAuthenticating}
                className="w-full py-4 rounded-2xl font-bold text-black active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center mt-2"
                style={{ background: "#A8FF3E", boxShadow: "0 4px 14px rgba(168,255,62,0.3), inset 0 1px 1px rgba(255,255,255,0.4)" }}
              >
                {isAuthenticating ? "Verifying…" : "Try Again"}
              </button>

              <button
                onClick={() => { setMode("pin"); setError(""); }}
                className="mt-1 h-10 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              >
                Use PIN instead
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">

              {/* 💎 PIN dots idénticos a los de settings.tsx */}
              <div className={cn("flex gap-3 py-2 justify-center items-center h-4", shake && "animate-shake")}>
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

              {error && (
                <p className="text-xs font-bold text-red-500 dark:text-red-400 text-center animate-in fade-in duration-200">{error}</p>
              )}

              {/* 💎 TECLADO LIGERO (IDÉNTICO AL MODAL DE CONFIGURACIÓN) */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-[220px] mx-auto pb-1 mt-1">
                {DIGITS.flat().map((digit, i) => {
                  if (digit === "") return <div key={i} />;
                  if (digit === "del") return (
                    <button
                      key={i}
                      onPointerDown={(e) => { e.preventDefault(); triggerHaptic(); handleDelete(); }}
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
                      onPointerDown={(e) => { e.preventDefault(); triggerHaptic(); handlePinDigit(digit); }}
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
                  className="mt-1 h-10 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
                >
                  Use biometrics instead
                </button>
              )}
            </div>
          )}
        </div>

        {/* Logo — abajo, centrado */}
        <div className="mt-5 flex items-center justify-center">
          {logoOk ? (
            <img
              src="/logo.png"
              alt="Flow!"
              className="h-6 object-contain opacity-90"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "#A8FF3E" }} />
              <span className="font-serif font-bold text-sm tracking-tight text-foreground">Flow!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
