import { useState } from "react";
import { Sun, Moon, Monitor, Trash2, Settings as SettingsIcon, LogOut, UserX, Download } from "lucide-react";
import { Link } from "wouter";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useCurrency, type Currency, CURRENCY_INFO } from "@/lib/currency-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getListTransactionsQueryKey, getGetDashboardSummaryQueryKey, getGetSpendingByCategoryQueryKey, getGetTopExpensesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { getApiUrl } from "@/lib/api-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";



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
  const { user, signOut, session } = useAuth();
  const queryClient = useQueryClient();
  const [erasing, setErasing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-lg">
      <div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1 text-sm">Preferences and account options.</p>
      </div>

      {/* Currency */}
      <SectionCard title="Currency">
      <SettingRow label="Display currency" description="All amounts will be shown in this currency">
  <Select value={currency} onValueChange={(val) => setCurrency(val as Currency)}>
  <SelectTrigger className="w-auto border-0 bg-[#A8FF3E] text-black font-bold text-sm px-3 py-2 rounded-xl">
  <SelectValue>
    {currency}
  </SelectValue>
</SelectTrigger>
    <SelectContent>
      {(Object.keys(CURRENCY_INFO) as Currency[]).map((c) => (
        <SelectItem key={c} value={c}>{CURRENCY_INFO[c].label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</SettingRow>
      </SectionCard>

      {/* Appearance */}
      <SectionCard title="Appearance">
        <SettingRow label="Theme" description="Switch between light and dark mode">
        <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
  <SelectTrigger className="w-auto border-0 bg-[#A8FF3E] text-black font-bold text-sm px-3 py-2 rounded-xl">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" />Light</div></SelectItem>
    <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" />Dark</div></SelectItem>
    <SelectItem value="system"><div className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" />System</div></SelectItem>
  </SelectContent>
</Select>
        </SettingRow>
      </SectionCard>

      {/* Data */}
      <SectionCard title="Data">
        <SettingRow label="Export to Excel" description="Download all your transactions as an Excel file">
          <Link href="/export">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </Link>
        </SettingRow>
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
                <AlertDialogDescription>This will permanently delete every transaction in your account. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleEraseAll} disabled={erasing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0">
                  {erasing ? "Erasing..." : "Yes, erase all"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SettingRow>
      </SectionCard>

      {/* Account */}
      <SectionCard title="Account">
        <SettingRow label="Signed in as" description={user?.email ?? ""}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
                <LogOut className="h-3.5 w-3.5" />
                {signingOut ? "Logging out..." : "Log Out"}
              </button>
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
        </SettingRow>

        <SettingRow label="Delete account" description="Permanently deletes your account and all data.">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-all">
                <UserX className="h-3.5 w-3.5" />
                {deletingAccount ? "Deleting..." : "Delete"}
              </button>
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
        </SettingRow>
      </SectionCard>

    </div>
  );
}