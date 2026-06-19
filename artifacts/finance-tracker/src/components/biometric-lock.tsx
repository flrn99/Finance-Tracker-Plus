import { useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, Trash2, ShieldAlert } from "lucide-react";
import { useBiometric, getStoredPin } from "@/lib/biometric-context";
import { cn } from "@/lib/utils";

const MAX_ATTEMPTS = 3;

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
        setError("Too many failed attempts. Enter your PIN.");
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

  const haptic = () => {
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
  };

  const DIGITS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)", backgroundColor: "hsl(var(--background))" }}
    >
      {/* Icon */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: mode === "biometric"
              ? "linear-gradient(135deg, rgba(124,58,255,0.2), rgba(124,58,255,0.08))"
              : "linear-gradient(135deg, rgba(168,255,62,0.2), rgba(168,255,62,0.08))",
          }}
        >
          {mode === "biometric"
            ? <Fingerprint className="h-10 w-10" style={{ color: "#7C3AFF" }} />
            : <KeyRound className="h-10 w-10 text-foreground" />
          }
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-foreground">
            {mode === "biometric" ? "Verify Identity" : "Enter PIN"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "biometric"
              ? "Use Face ID or fingerprint to unlock"
              : "Enter your 6-digit security PIN"
            }
          </p>
        </div>
      </div>

      {mode === "biometric" ? (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-2xl px-4 py-3 w-full">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          <button
            onClick={handleBiometric}
            disabled={isAuthenticating}
            className="w-full py-4 rounded-2xl font-bold text-black transition-all disabled:opacity-60"
            style={{ background: "#A8FF3E", boxShadow: "0 2px 12px rgba(168,255,62,0.3)" }}
          >
            {isAuthenticating ? "Verifying…" : "Try Again"}
          </button>

          <button
            onClick={() => { setMode("pin"); setError(""); setAttempts(0); }}
            className="text-sm font-semibold text-muted-foreground"
          >
            Use PIN instead
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          {/* PIN dots */}
          <div className={cn("flex gap-4 mb-2", shake && "animate-shake")}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-all duration-150"
                style={{
                  background: i < pin.length
                    ? "#0a0a0a"
                    : "hsl(var(--muted))",
                  transform: i < pin.length ? "scale(1.1)" : "scale(1)",
                }}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-2xl px-4 py-3 w-full">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold">{error}</p>
            </div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {DIGITS.flat().map((digit, i) => {
              if (digit === "") return <div key={i} />;
              if (digit === "del") return (
                <button
                  key={i}
                  onPointerDown={(e) => { e.preventDefault(); haptic(); handleDelete(); }}
                  disabled={pin.length === 0}
                  className="h-16 w-full rounded-2xl flex items-center justify-center bg-muted disabled:opacity-30"
                  style={{ touchAction: "manipulation" }}
                >
                  <Trash2 className="h-5 w-5 text-foreground" />
                </button>
              );
              return (
                <button
                  key={i}
                  onPointerDown={(e) => { e.preventDefault(); haptic(); handlePinDigit(digit); }}
                  disabled={pin.length >= 6}
                  className="h-16 w-full rounded-2xl flex items-center justify-center text-2xl font-bold text-foreground bg-muted disabled:opacity-30"
                  style={{ touchAction: "manipulation" }}
                >
                  {digit}
                </button>
              );
            })}
          </div>

          {attempts < MAX_ATTEMPTS && (
            <button
              onClick={() => { setMode("biometric"); setError(""); setPin(""); handleBiometric(); }}
              className="text-sm font-semibold text-muted-foreground"
            >
              Use biometrics instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
