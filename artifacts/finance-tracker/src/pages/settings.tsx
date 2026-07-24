import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Trash2, LogOut, UserX, Download, FileSpreadsheet, ChevronRight, ChevronLeft, DollarSign, User, Plus, Fingerprint, ShieldCheck, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useCurrency, type Currency, CURRENCY_INFO } from "@/lib/currency-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getListTransactionsQueryKey, getGetDashboardSummaryQueryKey, getGetSpendingByCategoryQueryKey, getGetTopExpensesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useBiometricPinFlow, BiometricPinModal } from "@/components/biometric-pin-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getApiUrl } from "@/lib/api-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExcelImportFlow from "@/components/excel-import-flow";

const THEME_OPTIONS: { value: Theme; label: string; icon: any }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">{title}</p>
  );
}

/** Fila hairline — reemplaza el viejo Section+SettingItem con cards (retirado,
 * ver DESIGN.md "Hairline, Not Card Rule"). Es <button> real por default para
 * que las filas navegables tengan foco de teclado; asStatic=true solo cuando
 * la fila ya contiene su propio control interactivo adentro (el toggle), para
 * no anidar un <button> dentro de otro. */
function SettingRow({
  icon: Icon,
  label,
  description,
  right,
  onClick,
  destructive,
  tinted,
  bordered = true,
  asStatic = false,
}: {
  icon: any;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  tinted?: boolean;
  bordered?: boolean;
  asStatic?: boolean;
}) {
  const Tag = (asStatic ? "div" : "button") as any;
  return (
    <Tag
      type={asStatic ? undefined : "button"}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-1 py-3.5 text-left",
        bordered && "border-b border-border",
        !asStatic && "transition-transform active:scale-[0.98]"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
        destructive ? "bg-destructive/10" : tinted ? "bg-[#00A870]/15" : "bg-muted"
      )}>
        <Icon className={cn(
          "h-4 w-4",
          destructive ? "text-destructive" : tinted ? "text-[#00593C] dark:text-[#6EE7B7]" : "text-foreground"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", destructive ? "text-destructive" : "text-foreground")}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1">{right}</div>
    </Tag>
  );
}

/** Toggle biométrico — <button role="switch"> real con el mismo thumb en
 * gradiente verde que RangeSwitch, en vez del <div onClick> anterior (sin
 * foco de teclado, sin rol de accesibilidad). */
export function BiometricToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Biometric lock"
      onClick={onToggle}
      className="relative w-[46px] h-[26px] rounded-full bg-muted shrink-0 transition-transform active:scale-95 before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-['']"
    >
      <span
        className="absolute top-0.5 left-0.5 w-[22px] h-[22px] rounded-full transition-transform duration-300"
        style={{
          transform: on ? "translateX(20px)" : "translateX(0)",
          background: on ? "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)" : "hsl(var(--background))",
          boxShadow: on
            ? "inset 0 1px 1px rgba(255,255,255,0.55), 0 2px 6px -1px rgba(124,181,24,0.5)"
            : "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { toast } = useToast();
  const { user, signOut, session } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [erasing, setErasing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const bio = useBiometricPinFlow();
  const [avatar, setAvatar] = useState<"male" | "female" | null>(() => {
    try { return localStorage.getItem("ff-avatar") as "male" | "female" | null; } catch { return null; }
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Entraba/salía de golpe, sin ninguna animación — mismo fix que el resto de
  // los modales de esta sesión: mounted/closing dan la entrada+salida
  // simétrica que ya usa FloatingModal en el resto de la app.
  const [avatarPickerMounted, setAvatarPickerMounted] = useState(false);
  const [avatarPickerClosing, setAvatarPickerClosing] = useState(false);
  useEffect(() => {
    if (showAvatarPicker) {
      setAvatarPickerMounted(true);
      setAvatarPickerClosing(false);
      return;
    }
    if (!avatarPickerMounted) return;
    setAvatarPickerClosing(true);
    const t = setTimeout(() => setAvatarPickerMounted(false), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAvatarPicker]);

  const selectAvatar = (a: "male" | "female") => {
    setAvatar(a);
    try { localStorage.setItem("ff-avatar", a); } catch {}
    try { window.dispatchEvent(new Event("ff-avatar-changed")); } catch {}
    setShowAvatarPicker(false);
  };

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

  const themeIndex = THEME_OPTIONS.findIndex((o) => o.value === theme);

  return (
    <div className="relative">
      {/* 🛡️ EL ESCUDO: Envuelve a toda la página de fondo. Si está activo, ignora todos los toques. */}
      <div className={cn(
        "space-y-7 animate-in fade-in duration-500 max-w-lg transition-all",
        bio.isGhostShieldActive && "pointer-events-none select-none"
      )}>
        {/* iOS no tiene botón de "atrás" físico como Android — Settings se
            entra desde el avatar en cualquiera de las 4 pestañas, así que
            vuelve a donde estabas en vez de a un destino fijo. */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {/* Profile header */}
        <div className="flex flex-col items-center justify-center py-4 gap-2 w-full">
          <div className="relative" onClick={() => setShowAvatarPicker(true)}>
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[#CAFA01]">
              {avatar ? (
                <img src={`/${avatar}.png`} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-10 w-10 text-black" />
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#CAFA01] border-2 border-background flex items-center justify-center">
              <Plus className="h-3 w-3 text-black" />
            </div>
          </div>

          {avatarPickerMounted && (
            <div
              className={cn(
                "fixed inset-0 z-50 flex items-end justify-center bg-black/40 pointer-events-auto duration-200",
                avatarPickerClosing ? "animate-out fade-out" : "animate-in fade-in"
              )}
              style={{ animationFillMode: avatarPickerClosing ? "forwards" : undefined }}
              onClick={() => setShowAvatarPicker(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Choose avatar"
            >
              <div
                className={cn(
                  "bg-background rounded-t-2xl p-6 w-full max-w-sm space-y-4 duration-200",
                  avatarPickerClosing ? "animate-out fade-out slide-out-to-bottom-4" : "animate-in fade-in slide-in-from-bottom-4"
                )}
                style={{ animationFillMode: avatarPickerClosing ? "forwards" : undefined }}
                onClick={(e) => e.stopPropagation()}
                onAnimationEnd={() => { if (avatarPickerClosing) setAvatarPickerMounted(false); }}
              >
                <p className="font-bold text-center text-foreground uppercase tracking-widest text-xs">Choose Avatar</p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => selectAvatar("male")} className={cn("rounded-2xl overflow-hidden border-4 transition-all", avatar === "male" ? "border-[#CAFA01]" : "border-transparent")}>
                    <img src="/male.png" alt="Male" className="w-28 h-28 object-cover" />
                  </button>
                  <button onClick={() => selectAvatar("female")} className={cn("rounded-2xl overflow-hidden border-4 transition-all", avatar === "female" ? "border-[#CAFA01]" : "border-transparent")}>
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

        {/* Preferences — Currency queda como Select (10 opciones, se toca una vez;
            un dropdown sigue siendo lo correcto acá). Theme pasa a segmentado con
            el mismo thumb verde de RangeSwitch (3 opciones, se toca seguido). */}
        <div className="space-y-1.5">
          <SectionTitle title="Preferences" />
          <div>
            <SettingRow
              asStatic
              icon={DollarSign}
              label="Display Currency"
              description="All amounts shown in this currency"
              right={
                <Select value={currency} onValueChange={(val) => setCurrency(val as Currency)}>
                  <SelectTrigger className="w-24 border-0 ring-0 focus:ring-0 bg-[#CAFA01] text-black font-bold text-sm px-3 py-1.5 rounded-full h-auto">
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
            <div className="px-1 py-3.5">
              <p className="text-sm font-semibold text-foreground mb-2.5">Theme</p>
              <div className="relative grid grid-cols-3 rounded-full bg-muted p-1">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-1 rounded-full transition-transform duration-300 ease-out"
                  style={{
                    width: "calc(33.333% - 0.1667rem)",
                    transform: `translateX(${themeIndex * 100}%)`,
                    background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
                  }}
                />
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      aria-label={opt.label}
                      className={cn(
                        "relative z-10 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors duration-300",
                        active ? "text-black" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-1.5">
          <SectionTitle title="Security" />
          <SettingRow
            asStatic
            bordered={false}
            icon={bio.isEnabled ? ShieldCheck : Fingerprint}
            label="Biometric Lock"
            description={bio.isEnabled ? "App is protected · Tap to disable" : "Require Face ID or fingerprint to open"}
            tinted={bio.isEnabled}
            right={<BiometricToggle on={bio.isEnabled} onToggle={bio.startToggle} />}
          />
        </div>

        {/* Data & Account — antes eran 2 secciones separadas; Erase se movió a
            Danger Zone, así que lo que queda acá ya no necesita cajones propios. */}
        <div className="space-y-1.5">
          <SectionTitle title="Data & Account" />
          <div>
            <SettingRow
              icon={FileSpreadsheet}
              label="Import from Excel"
              description="Bring transactions from a spreadsheet"
              onClick={() => setImportOpen(true)}
              right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
            />
            <SettingRow
              icon={Download}
              label="Export to Excel"
              description="Download all your transactions"
              onClick={() => navigate("/export")}
              right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
            />
            <ConfirmDialog
              trigger={
                <SettingRow
                  bordered={false}
                  icon={LogOut}
                  label={signingOut ? "Logging out..." : "Log Out"}
                  description={user?.email ?? ""}
                  right={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                />
              }
              icon={LogOut}
              variant="neutral"
              title="Log out?"
              description="You will need to log in again to access your data."
              confirmLabel={signingOut ? "Logging out..." : "Log Out"}
              disabled={signingOut}
              onConfirm={handleSignOut}
            />
          </div>
        </div>

        {/* Danger Zone — Erase y Delete Account aisladas del resto: sombra en
            capas en vez de borde duro, así se adapta a claro/oscuro sin
            recalcular un color de borde. */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "color-mix(in srgb, hsl(var(--destructive)) 5%, transparent)",
            boxShadow: "0 0 0 1px color-mix(in srgb, hsl(var(--destructive)) 22%, transparent)",
          }}
        >
          <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Danger Zone</span>
          </div>
          <div className="px-3">
            <ConfirmDialog
              trigger={
                <SettingRow
                  icon={Trash2}
                  label="Erase All Transactions"
                  description="Permanently deletes every transaction"
                  destructive
                  right={<ChevronRight className="h-4 w-4 text-destructive" />}
                />
              }
              icon={Trash2}
              title="Erase all transactions?"
              description="This will permanently delete every transaction. This cannot be undone."
              confirmLabel={erasing ? "Erasing..." : "Yes, erase all"}
              disabled={erasing}
              onConfirm={handleEraseAll}
            />
            <ConfirmDialog
              trigger={
                <SettingRow
                  bordered={false}
                  icon={UserX}
                  label={deletingAccount ? "Deleting..." : "Delete Account"}
                  destructive
                  right={<ChevronRight className="h-4 w-4 text-destructive" />}
                />
              }
              icon={UserX}
              title="Delete your account?"
              description="This will permanently delete your account, all transactions, and all categories. This action cannot be undone."
              confirmLabel={deletingAccount ? "Deleting..." : "Yes, delete account"}
              disabled={deletingAccount}
              onConfirm={handleDeleteAccount}
            />
          </div>
        </div>
      </div>

      <BiometricPinModal flow={bio} />
      {importOpen && <ExcelImportFlow onClose={() => setImportOpen(false)} />}
    </div>
  );
}
