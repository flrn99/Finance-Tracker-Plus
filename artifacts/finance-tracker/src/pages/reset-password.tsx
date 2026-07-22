import { useId, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function ResetPassword({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const handleReset = async () => {
    if (!password || !confirm) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Password updated!", description: "You're now logged in.", variant: "celebration" });
      onDone();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}>
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto space-y-5">
        <div className="mb-2">
          <h1 className="font-display text-2xl text-foreground">New Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your new password below.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={newPasswordId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id={newPasswordId}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-10 py-3 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={confirmPasswordId} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id={confirmPasswordId}
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
            />
          </div>
        </div>

        <button
          onClick={handleReset}
          disabled={isLoading}
          className="w-full py-3 rounded-2xl text-black text-sm font-bold transition-all disabled:opacity-60 border-0"
          style={{
            background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
          }}
        >
          {isLoading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
