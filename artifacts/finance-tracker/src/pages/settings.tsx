import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Trash2, LogOut, UserX, Download, ChevronRight, DollarSign, Palette, Database, User, Plus, Fingerprint, ShieldCheck, X } from "lucide-react";
import { Link } from "wouter";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useCurrency, type Currency, CURRENCY_INFO } from "@/lib/currency-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getListTransactionsQueryKey, getGetDashboardSummaryQueryKey, getGetSpendingByCategoryQueryKey, getGetTopExpensesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useBiometric } from "@/lib/biometric-context";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { getApiUrl } from "@/lib/api-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-2">{title}</p>
  );
}

function SettingItem({
  icon: Icon,
  label,
  description,
  right,
  onClick,
  destructive,
}: {
  icon: any;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center gap-4 px-4 py-3.5 cursor-pointer active:bg-muted/50 transition-colors", onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center shrink-0", destructive ? "bg-destructive/10" : "bg-muted")}>
        <Icon className={cn("h-4 w-4", destructive ? "text-destructive" : "text-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", destructive ? "text-destructive" : "text-foreground")}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1">
        {right}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { toast } = useToast();
  const { user, signOut, session } = useAuth();
  const queryClient = useQueryClient();
  const [erasing, setErasing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { isEnabled: biometricEnabled, isSupported: biometricSupported, enable: enableBiometric, disable: disableBiometric } = useBiometric();
  const [showPinSetup, setShowPinSetup] = useState(false);
  
  // 🛡️ ESTADO DEL ESCUDO ANTI-GHOST CLICKS
  const [isGhostShieldActive, setIsGhostShieldActive] = useState(false);

  const [pinStep, setPinStep] = useState<"enter" | "confirm" | "disable">("enter");
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [avatar, setAvatar] = useState<"male" | "female" | null>(() => {
    try { return localStorage.getItem("ff-avatar") as "male" | "female" | null; } catch { return null; }
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const selectAvatar = (a: "male" | "female") => {
    setAvatar(a);
    try { localStorage.setItem("ff-avatar", a); } catch {}
    try { window.dispatchEvent(new Event("ff-avatar-changed")); } catch {}
    setShowAvatarPicker(false);
  };

  // Sección activa (?section= del dropdown de perfil) — muestra SOLO esa sección
  const [activeSection, setActiveSection] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get("section"); } catch { return null; }
  });
  const showSec = (s: string) => !activeSection || activeSection === s;

  const handleEraseAll = async () => {
    setErasing(true);
    try {
      const res = await fetch(getApiUrl("/api/transactions"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
      queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({}) });
      toast({ title: "All transactions erased." });
    } catch {
      toast({ title: "Failed to erase transactions.", variant: "destructive" });
    } finally {
      setErasing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast({ title: "Failed to sign out.", variant: "destructive" });
      setSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await fetch(getApiUrl("/api/account"), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed");
      await signOut();
    } catch {
      toast({ title: "Failed to delete account.", variant: "destructive" });
      setDeletingAccount(false);
    }
  };

  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  // 🛡️ FUNCIÓN DE CIERRE BLINDADA
  const closePinModal = () => {
    // 1. Activamos el escudo en la página de fondo inmediatamente
    setIsGhostShieldActive(true);
    
    // 2. El delay original de 150ms para terminar la animación de tap
    setTimeout(() => {
      setShowPinSetup(false);
      
      // 3. Mantenemos el escudo por 400ms extra para aniquilar el doble tap
      setTimeout(() => {
        setIsGhostShieldActive(false);
      }, 400);
    }, 150);
  };

  const handleBiometricToggle = async () => {
    if (biometricEnabled) {
      setShowPinSetup(true);
      setPinStep("disable");
      setPinValue("");
      setPinError("");
      return;
    }
    if (!biometricSupported) {
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

  const handlePinDigit = (digit: string) => {
    if (pinStep === "disable") {
      if (pinValue.length >= 6) return;
      const next = pinValue + digit;
      setPinValue(next);
      if (next.length === 6) {
        const success = disableBiometric(next);
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
    if (pinStep === "enter" || pinStep === "disable") setPinValue(p => p.slice(0, -1));
    else setPinConfirm(p => p.slice(0, -1));
    setPinError("");
  };

  const handleEnableBiometric = async (pin: string) => {
    setBiometricLoading(true);
    const result = await enableBiometric(pin);
    setBiometricLoading(false);
    if (result.success) {
      closePinModal();
      toast({ title: "Biometric lock enabled", description: "Your app is now protected." });
    } else {
      if (result.error === "biometrics_not_configured") {
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
    }
  };

  const PIN_DIGITS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  const currentPin = pinStep === "confirm" ? pinConfirm : pinValue;

  const haptic = () => {
    import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
  };

  return (
    <div className="relative">
      {/* 🛡️ EL ESCUDO: Envuelve a toda la página de fondo. Si está activo, ignora todos los toques. */}
      <div className={cn(
        "space-y-6 animate-in fade-in duration-500 max-w-lg transition-all",
        isGhostShieldActive && "pointer-events-none select-none"
      )}>
        {/* Barra de regreso cuando se ve una sola sección */}
        {activeSection && (
          <button
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            All Settings
          </button>
        )}

        {/* Profile header */}
        <div id="section-profile" className={cn("flex flex-col items-center justify-center py-4 gap-2 w-full", !showSec("profile") && "hidden")}>
          <div className="relative" onClick={() => setShowAvatarPicker(true)}>
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#A8FF3E]">
              {avatar ? (
                <img src={`/${avatar}.png`} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-10 w-10 text-black" />
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#A8FF3E] border-2 border-background flex items-center justify-center">
              <Plus className="h-3 w-3 text-black" />
            </div>
          </div>

          {showAvatarPicker && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pointer-events-auto" onClick={() => setShowAvatarPicker(false)}>
              <div className="bg-background rounded-t-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
                <p className="font-bold text-center text-foreground uppercase tracking-widest text-xs">Choose Avatar</p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => selectAvatar("male")} className={cn("rounded-2xl overflow-hidden border-4 transition-all", avatar === "male" ? "border-[#A8FF3E]" : "border-transparent")}>
                    <img src="/male.png" alt="Male" className="w-28 h-28 object-cover" />
                  </button>
                  <button onClick={() => selectAvatar("female")} className={cn("rounded-2xl overflow-hidden border-4 transition-all", avatar === "female" ? "border-[#A8FF3E]" : "border-transparent")}>
                    <img src="/female.png" alt="Female" className="w-28 h-28 object-cover" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="text-center">
            <p className="font-bold text-lg text-foreground">{user?.user_metadata?.name || user?.email?.split("@")[0]}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Preferences */}
        <div id="section-preferences" className={cn("space-y-2", !showSec("preferences") && "hidden")}>
          <SectionTitle title="Preferences" />
          <Section>
            <SettingItem
              icon={DollarSign}
              label="Display Currency"
              description="All amounts shown in this currency"
              right={
                <Select value={currency} onValueChange={(val) => setCurrency(val as Currency)}>
                  <SelectTrigger className="w-24 border-0 ring-0 focus:ring-0 bg-[#A8FF3E] text-black font-bold text-sm px-3 py-1.5 rounded-full h-auto">
                    <SelectValue>{currency}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CURRENCY_INFO) as Currency[]).map((c) => (
                      <SelectItem key={c} value={c}>{CURRENCY_INFO[c].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            <SettingItem
              icon={Palette}
              label="Theme"
              description="Switch between light and dark mode"
              right={
                <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
                  <SelectTrigger className="w-24 border-0 ring-0 focus:ring-0 bg-[#A8FF3E] text-black font-bold text-sm px-3 py-1.5 rounded-full h-auto">
                    <SelectValue>{themeLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" />Light</div></SelectItem>
                    <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" />Dark</div></SelectItem>
                    <SelectItem value="system"><div className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" />System</div></SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </Section>
        </div>

        {/* Data */}
        <div id="section-data" className={cn("space-y-2", !showSec("data") && "hidden")}>
          <SectionTitle title="Data" />
          <Section>
            <Link href="/export">
              <SettingItem
                icon={Download}
                label="Export to Excel"
                description="Download all your transactions"
                right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
              />
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div>
                  <SettingItem
                    icon={Trash2}
                    label="Erase All Transactions"
                    description="Permanently deletes every transaction"
                    destructive
                    right={<ChevronRight className="h-4 w-4 text-destructive" />}
                  />
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Erase all transactions?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete every transaction. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEraseAll} disabled={erasing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0">
                    {erasing ? "Erasing..." : "Yes, erase all"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Section>
        </div>

        {/* Security */}
        <div id="section-security" className={cn("space-y-2", !showSec("security") && "hidden")}>
          <SectionTitle title="Security" />
          <Section>
            <SettingItem
              icon={biometricEnabled ? ShieldCheck : Fingerprint}
              label="Biometric Lock"
              description={biometricEnabled ? "App is protected · Tap to disable" : "Require Face ID or fingerprint to open"}
              right={
                <div
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors duration-300 relative cursor-pointer",
                    biometricEnabled ? "bg-[#A8FF3E]" : "bg-muted"
                  )}
                  onClick={handleBiometricToggle}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300"
                    style={{ transform: biometricEnabled ? "translateX(26px)" : "translateX(2px)" }}
                  />
                </div>
              }
            />
          </Section>
        </div>

        {/* Account - ESTA ES LA SECCIÓN QUE ME COMÍ */}
        <div id="section-account" className={cn("space-y-2", !showSec("account") && "hidden")}>
          <SectionTitle title="Account" />
          <Section>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div>
                  <SettingItem
                    icon={LogOut}
                    label={signingOut ? "Logging out..." : "Log Out"}
                    description={user?.email ?? ""}
                    right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out?</AlertDialogTitle>
                  <AlertDialogDescription>You will need to log in again to access your data.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut} disabled={signingOut} className="bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0">
                    {signingOut ? "Logging out..." : "Log Out"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div>
                  <SettingItem
                    icon={UserX}
                    label={deletingAccount ? "Deleting..." : "Delete Account"}
                    destructive
                    right={<ChevronRight className="h-4 w-4 text-destructive" />}
                  />
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete your account, all transactions, and all categories. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAccount} disabled={deletingAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0">
                    {deletingAccount ? "Deleting..." : "Yes, delete account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Section>
        </div>
      </div>

      {/* PIN Setup Modal ── EXACTAMENTE TU CÓDIGO CON TACTO PERFECTO */}
      {showPinSetup && (
        <div
          className="fixed top-0 left-0 w-screen h-screen z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            closePinModal();
          }}
        >
          {/* 🛠️ BACKDROP 80%: Negro más oscuro, igual al del AlertDialog de Erase All Transactions */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vh] bg-black/80 z-0 animate-in fade-in duration-200 pointer-events-none" />

          {/* 💎 CRISTAL REAL GRIS ESPACIAL: Menos negro, más elegante con backdrop-blur-24px */}
          <div 
            className="relative z-10 w-full max-w-[310px] bg-white/85 dark:bg-[#242427]/85 border border-black/5 dark:border-white/10 shadow-2xl rounded-[36px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="relative p-6 flex flex-col items-center">
              {/* Header */}
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
                      : "Re-enter your PIN to confirm"
                    }
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    closePinModal();
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors shrink-0 active:scale-90"
                >
                  <X className="h-4 w-4 text-foreground/80" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-4 w-full mt-1">
                {/* PIN dots */}
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

                {/* Numpad Botones Limpios (Apple-like) */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-[210px] mx-auto pb-1 mt-1">
                  {PIN_DIGITS.flat().map((digit, i) => {
                    if (digit === "") return <div key={i} />;
                    if (digit === "del") return (
                      <button
                        key={i}
                        onPointerDown={(e) => { e.preventDefault(); haptic(); handlePinDelete(); }}
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
                        onPointerDown={(e) => { e.preventDefault(); haptic(); handlePinDigit(digit); }}
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
      )}

    </div>
  );
}