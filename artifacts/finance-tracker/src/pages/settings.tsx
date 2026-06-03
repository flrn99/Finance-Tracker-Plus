import { useState } from "react";
import { Sun, Moon, Monitor, Trash2, LogOut, UserX, Download, ChevronRight, DollarSign, Palette, Database, User, Plus } from "lucide-react";
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
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", destructive ? "bg-destructive/10" : "bg-muted")}>
        <Icon className={cn("h-4 w-4", destructive ? "text-destructive" : "text-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", destructive ? "text-destructive" : "text-foreground")}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1">
        {right}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-border">
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
  const [avatar, setAvatar] = useState<"male" | "female" | null>(() => {
  try { return localStorage.getItem("ff-avatar") as "male" | "female" | null; } catch { return null; }
});
const [showAvatarPicker, setShowAvatarPicker] = useState(false);

const selectAvatar = (a: "male" | "female") => {
  setAvatar(a);
  try { localStorage.setItem("ff-avatar", a); } catch {}
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

  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-lg">

      {/* Profile header */}
      <div className="flex flex-col items-center justify-center py-4 gap-2 w-full">
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
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAvatarPicker(false)}>
    <div className="bg-background rounded-t-3xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
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
      <div className="space-y-2">
        <SectionTitle title="Preferences" />
        <Section>
          <SettingItem
            icon={DollarSign}
            label="Display Currency"
            description="All amounts shown in this currency"
            right={
              <Select value={currency} onValueChange={(val) => setCurrency(val as Currency)}>
                <SelectTrigger className="w-auto border-0 ring-0 focus:ring-0 bg-[#A8FF3E] text-black font-bold text-sm px-3 py-1.5 rounded-xl h-auto">
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
                <SelectTrigger className="w-auto border-0 ring-0 focus:ring-0 bg-[#A8FF3E] text-black font-bold text-sm px-3 py-1.5 rounded-xl h-auto">
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
      <div className="space-y-2">
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

      {/* Account */}
      <div className="space-y-2">
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
                  description="Permanently deletes your account and all data"
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
  );
}
