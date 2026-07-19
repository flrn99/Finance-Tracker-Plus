import { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBiometric } from "@/lib/biometric-context";

type PinStep = "enter" | "confirm" | "disable";

/** Todo el flujo de enrolar/desenrolar biometric lock (PIN de 6 dígitos +
 * el modal en sí) — extraído de settings.tsx para que Onboarding lo pueda
 * reusar sin duplicar ~150 líneas de estado y JSX. */
export function useBiometricPinFlow() {
  const { toast } = useToast();
  const { isEnabled, isSupported, enable, disable } = useBiometric();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [isGhostShieldActive, setIsGhostShieldActive] = useState(false);
  const [pinStep, setPinStep] = useState<PinStep>("enter");
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const firedByPointer = useRef(false);

  const closePinModal = () => {
    setIsGhostShieldActive(true);
    setTimeout(() => {
      setShowPinSetup(false);
      setTimeout(() => setIsGhostShieldActive(false), 400);
    }, 150);
  };

  const startToggle = () => {
    if (isEnabled) {
      setShowPinSetup(true);
      setPinStep("disable");
      setPinValue("");
      setPinError("");
      return;
    }
    if (!isSupported) {
      toast({
        title: "Biometrics not available",
        description: "Please configure Face ID or fingerprint in your device settings first.",
        variant: "destructive",
      });
      return;
    }
    setShowPinSetup(true);
    setPinStep("enter");
    setPinValue("");
    setPinConfirm("");
    setPinError("");
  };

  const handleEnableBiometric = async (pin: string) => {
    setBiometricLoading(true);
    const result = await enable(pin);
    setBiometricLoading(false);
    if (result.success) {
      closePinModal();
      toast({ title: "Biometric lock enabled", description: "Your app is now protected." });
    } else if (result.error === "biometrics_not_configured") {
      closePinModal();
      toast({
        title: "Biometrics not configured",
        description: "Please set up Face ID or fingerprint in your device settings first.",
        variant: "destructive",
      });
    } else {
      setPinError("Biometric authentication failed. Try again.");
      setTimeout(() => {
        setPinStep("enter");
        setPinValue("");
        setPinConfirm("");
        setPinError("");
      }, 1000);
    }
  };

  const handlePinDigit = async (digit: string) => {
    if (pinStep === "disable") {
      if (pinValue.length >= 6) return;
      const next = pinValue + digit;
      setPinValue(next);
      if (next.length === 6) {
        const success = await disable(next);
        if (success) {
          closePinModal();
          toast({ title: "Biometric lock disabled" });
        } else {
          setPinError("Incorrect PIN. Try again.");
          setTimeout(() => {
            setPinValue("");
            setPinError("");
          }, 800);
        }
      }
      return;
    }
    if (pinStep === "enter") {
      if (pinValue.length >= 6) return;
      const next = pinValue + digit;
      setPinValue(next);
      if (next.length === 6) {
        setTimeout(() => {
          setPinStep("confirm");
          setPinConfirm("");
          setPinError("");
        }, 150);
      }
    } else {
      if (pinConfirm.length >= 6) return;
      const next = pinConfirm + digit;
      setPinConfirm(next);
      if (next.length === 6) {
        if (next !== pinValue) {
          setPinError("PINs don't match. Try again.");
          setTimeout(() => {
            setPinStep("enter");
            setPinValue("");
            setPinConfirm("");
            setPinError("");
          }, 800);
        } else {
          handleEnableBiometric(next);
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === "enter" || pinStep === "disable") setPinValue((p) => p.slice(0, -1));
    else setPinConfirm((p) => p.slice(0, -1));
    setPinError("");
  };

  return {
    isEnabled, isSupported,
    showPinSetup, isGhostShieldActive,
    pinStep, pinValue, pinConfirm, pinError, biometricLoading,
    firedByPointer,
    startToggle, closePinModal, handlePinDigit, handlePinDelete,
  };
}

export type BiometricPinFlow = ReturnType<typeof useBiometricPinFlow>;

const PIN_DIGITS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "del"],
];

const haptic = () => {
  import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }).catch(() => {});
};

/** El modal en sí — EXACTAMENTE el mismo look/tacto que ya estaba tuneado
 * en settings.tsx, ahora parametrizado por el hook de arriba. */
export function BiometricPinModal({ flow }: { flow: BiometricPinFlow }) {
  const { showPinSetup, pinStep, pinValue, pinConfirm, pinError, biometricLoading, firedByPointer,
    closePinModal, handlePinDigit, handlePinDelete } = flow;

  if (!showPinSetup) return null;
  const currentPin = pinStep === "confirm" ? pinConfirm : pinValue;

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={pinStep === "disable" ? "Enter PIN" : pinStep === "enter" ? "Create PIN" : "Confirm PIN"}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); closePinModal(); }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vh] bg-black/80 z-0 animate-in fade-in duration-200 pointer-events-none" />
      <div
        className="relative z-10 w-full max-w-[310px] bg-white/85 dark:bg-[#242427]/85 border border-black/5 dark:border-white/10 shadow-2xl rounded-[36px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 flex flex-col items-center">
          <div className="flex items-start justify-between w-full mb-3 gap-2">
            <div className="space-y-0.5 flex-1 min-w-0">
              <p className="font-bold text-xl tracking-tight text-foreground">
                {pinStep === "disable" ? "Enter PIN" : pinStep === "enter" ? "Create PIN" : "Confirm PIN"}
              </p>
              <p className="text-xs font-medium text-muted-foreground truncate w-full">
                {pinStep === "disable"
                  ? "Enter your PIN to disable lock"
                  : pinStep === "enter"
                  ? "Set a 6-digit PIN as backup"
                  : "Re-enter your PIN to confirm"}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); closePinModal(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors shrink-0 active:scale-90"
            >
              <X className="h-4 w-4 text-foreground/80" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 w-full mt-1">
            <div className="flex gap-2.5 py-2 justify-center items-center">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i < currentPin.length ? "14px" : "12px",
                    height: i < currentPin.length ? "14px" : "12px",
                    background: i < currentPin.length ? "currentColor" : "transparent",
                    border: "1.5px solid currentColor",
                    opacity: i < currentPin.length ? 1 : 0.2,
                    transform: i < currentPin.length ? "scale(1.05)" : "scale(1)",
                  }}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-xs font-bold text-red-500 dark:text-red-400 text-center animate-in fade-in duration-200">{pinError}</p>
            )}
            {biometricLoading && (
              <p className="text-xs font-medium text-muted-foreground">Verifying biometrics…</p>
            )}

            <div className="grid grid-cols-3 gap-3 w-full max-w-[210px] mx-auto pb-1 mt-1">
              {PIN_DIGITS.flat().map((digit, i) => {
                if (digit === "") return <div key={i} />;
                if (digit === "del") return (
                  <button
                    key={i}
                    onPointerDown={(e) => { e.preventDefault(); firedByPointer.current = true; haptic(); handlePinDelete(); }}
                    onClick={() => { if (firedByPointer.current) { firedByPointer.current = false; return; } handlePinDelete(); }}
                    disabled={currentPin.length === 0}
                    className="relative h-14 w-14 rounded-full mx-auto flex items-center justify-center bg-black/5 dark:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/15 active:scale-90 transition-all disabled:opacity-20 shrink-0"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Trash2 className="relative z-10 h-5 w-5 text-foreground/90" />
                  </button>
                );
                return (
                  <button
                    key={i}
                    onPointerDown={(e) => { e.preventDefault(); firedByPointer.current = true; haptic(); handlePinDigit(digit); }}
                    onClick={() => { if (firedByPointer.current) { firedByPointer.current = false; return; } handlePinDigit(digit); }}
                    disabled={currentPin.length >= 6}
                    className="relative h-14 w-14 rounded-full mx-auto flex items-center justify-center bg-black/5 dark:bg-white/[0.06] active:bg-black/10 dark:active:bg-white/15 active:scale-90 transition-all disabled:opacity-20 shrink-0"
                    style={{ touchAction: "manipulation", fontFeatureSettings: "'tnum' on" }}
                  >
                    <span className="relative z-10 text-2xl font-medium tracking-tight text-foreground/90">{digit}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
