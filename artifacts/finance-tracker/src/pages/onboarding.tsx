import { useState } from "react";
import { Sun, Moon, Monitor, DollarSign, Fingerprint, ShieldCheck, FileSpreadsheet, ChevronRight } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useCurrency, type Currency, CURRENCY_INFO } from "@/lib/currency-context";
import { useBiometricPinFlow, BiometricPinModal } from "@/components/biometric-pin-modal";
import { BiometricToggle } from "@/pages/settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoMark } from "@/components/logo-mark";
import ExcelImportFlow from "@/components/excel-import-flow";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: Theme; label: string; icon: any }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Se muestra una sola vez, justo después de que una cuenta recién creada
 * entra por primera vez — ver isNewAccount en auth-context.tsx (reusa la
 * misma detección de "sin categorías todavía" que ya sembraba los defaults,
 * no un flag de localStorage aparte). Currency/Theme/Biometric son los
 * MISMOS controles y componentes que Settings, no una versión nueva. */
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const bio = useBiometricPinFlow();
  const themeIndex = THEME_OPTIONS.findIndex((o) => o.value === theme);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex-1 flex flex-col justify-center px-6 max-w-sm w-full mx-auto py-10">
        <LogoMark height={48} className="self-start mb-5" />
        <h1 className="font-display text-2xl text-foreground">Set up Flow!</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-8">A few quick things before you start</p>

        <div className="space-y-7">
          {/* Currency */}
          <div className="flex items-center justify-between gap-3 pb-5 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <DollarSign className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Display Currency</p>
                <p className="text-xs text-muted-foreground mt-0.5">You can change this later</p>
              </div>
            </div>
            <Select value={currency} onValueChange={(val) => setCurrency(val as Currency)}>
              <SelectTrigger className="w-24 border-0 ring-0 focus:ring-0 bg-[#CAFA01] text-black font-bold text-sm px-3 py-1.5 rounded-full h-auto shrink-0">
                <SelectValue>{currency}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CURRENCY_INFO) as Currency[]).map((c) => (
                  <SelectItem key={c} value={c}>{CURRENCY_INFO[c].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Theme */}
          <div className="pb-7 border-b border-border">
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

          {/* Biometric lock — solo tiene sentido ofrecerlo si el device lo soporta */}
          {bio.isSupported && (
            <div className="flex items-center gap-4 pb-5 border-b border-border">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", bio.isEnabled ? "bg-[#00A870]/15" : "bg-muted")}>
                {bio.isEnabled
                  ? <ShieldCheck className="h-4 w-4 text-[#00593C] dark:text-[#6EE7B7]" />
                  : <Fingerprint className="h-4 w-4 text-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Biometric Lock</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bio.isEnabled ? "Your app is protected" : "Require Face ID or fingerprint to open"}
                </p>
              </div>
              <BiometricToggle on={bio.isEnabled} onToggle={bio.startToggle} />
            </div>
          )}

          {/* Import — uso único, pensado para el día 1 (traer historial viejo).
              No vive en Settings ni en el nav: si el usuario lo salta acá, no
              hay otro lugar para volver a hacerlo. */}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Import old transactions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Bring your history from a spreadsheet</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>

        <button
          onClick={onDone}
          className="w-full py-3.5 rounded-2xl text-black text-sm font-bold transition-transform active:scale-[0.98] mt-10"
          style={{
            background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
          }}
        >
          Get Started
        </button>
        <button onClick={onDone} className="text-center text-sm text-muted-foreground mt-4">
          Skip for now
        </button>
      </div>

      <BiometricPinModal flow={bio} />
      {importOpen && <ExcelImportFlow onClose={() => setImportOpen(false)} />}
    </div>
  );
}
