import { useState } from "react";
import { Sun, Moon, DollarSign, Trash2, Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useCurrency, type Currency } from "@/lib/currency-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListTransactionsQueryKey, getGetDashboardSummaryQueryKey, getGetSpendingByCategoryQueryKey, getGetTopExpensesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 px-5">
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [erasing, setErasing] = useState(false);

  const handleEraseAll = async () => {
    setErasing(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/transactions`, { method: "DELETE" });
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-lg">
      <div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1 text-sm">Preferences and account options.</p>
      </div>

      {/* Appearance */}
      <SectionCard title="Appearance">
        <SettingRow label="Theme" description="Switch between light and dark mode">
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-all",
                theme === "light"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-all",
                theme === "dark"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
          </div>
        </SettingRow>
      </SectionCard>

      {/* Currency */}
      <SectionCard title="Currency">
        <SettingRow label="Display currency" description="All amounts will be shown in this currency">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(["GTQ", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "px-3 py-2 text-sm font-semibold transition-all",
                  currency === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                {c === "GTQ" ? "Q GTQ" : "$ USD"}
              </button>
            ))}
          </div>
        </SettingRow>
      </SectionCard>

      {/* Data */}
      <SectionCard title="Data">
        <SettingRow label="Erase all transactions" description="Permanently deletes every transaction. This cannot be undone.">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-all">
                <Trash2 className="h-3.5 w-3.5" />
                Erase all
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Erase all transactions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete every transaction in your account. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleEraseAll}
                  disabled={erasing}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {erasing ? "Erasing..." : "Yes, erase all"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingRow>
      </SectionCard>
    </div>
  );
}
