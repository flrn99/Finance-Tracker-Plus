import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function Login() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (mode === "register" && !firstName) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              name: firstName,
            }
          }
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Check your email to verify your account." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 py-8 overflow-y-auto">
      <div className="flex flex-col items-center gap-2 mb-4">
        <img src="logo.png" alt="FinanceFlow" className="w-48 h-40 object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-serif font-bold text-foreground">FinanceFlow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your personal finance tracker</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-card border border-card-border rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setMode("login")}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold transition-all",
              mode === "login"
                ? "bg-sidebar-primary text-white"
                : "bg-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("register")}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold transition-all",
              mode === "register"
                ? "bg-sidebar-primary text-white"
                : "bg-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            Register
          </button>
        </div>

        {mode === "register" && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-primary/30 focus:border-sidebar-primary transition-all"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-primary/30 focus:border-sidebar-primary transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-sidebar-primary/30 focus:border-sidebar-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-2.5 rounded-lg bg-sidebar-primary text-white text-sm font-semibold hover:bg-sidebar-primary/90 transition-all disabled:opacity-60 shadow-sm"
        >
          {isLoading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={isGoogleLoading}
          className="w-full py-2.5 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-muted transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
