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
    // 💎 Fondo premium con sutil viñeta para centrar la atención
    <div 
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center px-6 animate-in fade-in duration-300"
      style={{ 
        paddingTop: "env(safe-area-inset-top)", 
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)", 
        background: "radial-gradient(circle at center, hsl(var(--background)), hsl(var(--background)/0.95))",
        backgroundColor: "hsl(var(--background))"
      }}
    >
      {/* Container Principal */}
      <div className="w-full max-w-sm flex flex-col items-center">
        
        {/* Icon & Title */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_8px_24px_rgba(0,0,0,0.05)]"
            style={{
              background: mode === "biometric"
                ? "linear-gradient(135deg, rgba(124,58,255,0.15), rgba(124,58,255,0.05))"
                : "linear-gradient(135deg, rgba(168,255,62,0.15), rgba(168,255,62,0.05))",
              border: "1px solid rgba(255,255,255,0.05)"
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
        <div className="w-full relative min-h-[320px] flex flex-col items-center justify-start pt-2">
          
          {mode === "biometric" ? (
            <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in-95 duration-300">
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
                style={{ background: "#A8FF3E", boxShadow: "0 4px 14px rgba(168,255,62,0.2), inset 0 1px 1px rgba(255,255,255,0.4)" }}
              >
                {isAuthenticating ? "Verifying…" : "Try Again"}
              </button>

              <button
                onClick={() => { setMode("pin"); setError(""); }}
                className="mt-2 h-10 px-6 rounded-full flex items-center justify-center text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-muted transition-colors active:scale-95"
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
              <div className="grid grid-cols-3 gap-4 w-full max-w-[220px] mx-auto pb-1 mt-2">
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
      </div>
    </div>
  );
}