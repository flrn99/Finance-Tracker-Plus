import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { App } from "@capacitor/app";

type Mode = "home" | "login" | "register" | "forgot";

export default function Login() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [previousMode, setPreviousMode] = useState<Mode>("home");

  useEffect(() => {
    const handler = App.addListener("backButton", () => {
      if (mode === "register") setMode(previousMode);
      else if (mode === "login" || mode === "forgot") setMode("home");
      else if (mode === "home") App.exitApp();
    });
    return () => { handler.then(h => h.remove()); };
  }, [mode]);

  const handleSubmit = async () => {
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
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
            data: { first_name: firstName, name: firstName },
          },
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
      const { Browser } = await import("@capacitor/browser");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { 
          redirectTo: "com.florian.financetracker://login-callback",
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data.url) await Browser.open({ url: data.url });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsGoogleLoading(false);
    }
  };

  // Email/Login form screen
  if (mode === "login" || mode === "register" || mode === "forgot") {
    if (mode === "forgot") {
      return (
        <div className="min-h-screen bg-background flex flex-col p-6">
          <button onClick={() => setMode("login")} className="flex items-center gap-2 px-4 h-10 w-fit rounded-full bg-muted hover:bg-muted/80 transition-all mb-8" style={{ marginTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
  <ArrowLeft className="h-4 w-4 text-foreground" />
  <span className="text-sm font-semibold text-foreground">Back</span>
</button>
          <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto space-y-5">
            <div className="mb-2">
              <h1 className="text-2xl font-serif font-bold text-foreground">Reset password</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send you a reset link.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!email) { toast({ title: "Enter your email", variant: "destructive" }); return; }
                setIsLoading(true);
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: "com.florian.financetracker://login-callback?type=recovery",
                });
                                setIsLoading(false);
                if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                toast({ title: "Email sent!", description: "Check your inbox for the reset link." });
                setMode("login");
              }}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#A8FF3E] text-black text-sm font-semibold hover:bg-[#9bfe32] transition-all disabled:opacity-60 shadow-sm border-0"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex flex-col p-6">
        <button onClick={() => setMode(mode === "register" ? previousMode : "home")} className="flex items-center gap-2 px-4 h-10 w-fit rounded-full bg-muted hover:bg-muted/80 transition-all mb-8" style={{ marginTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
  <ArrowLeft className="h-4 w-4 text-foreground" />
  <span className="text-sm font-semibold text-foreground">Back</span>
</button>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto space-y-5">
          <div className="mb-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" ? "Sign in to your Flow Finance account" : "Start tracking your finances"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
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
                className="w-full pl-9 pr-10 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40 transition-all"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#A8FF3E] text-black text-sm font-semibold hover:bg-[#9bfe32] transition-all disabled:opacity-60 shadow-sm border-0"
          >
            {isLoading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          {mode === "login" && (
            <button onClick={() => setMode("forgot")} className="text-sm text-muted-foreground underline w-full text-right -mt-2">
              Forgot password?
            </button>
          )}

{mode === "login" && (
  <p className="text-center text-sm text-muted-foreground">
    Don't have an account?{" "}
    <button onClick={() => { setPreviousMode("login"); setMode("register"); }} className="font-semibold text-foreground">
      Register
    </button>
  </p>
)}
        </div>
      </div>
    );
  }

  // Home screen
  return (
      <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {/* Top section - imagen card */}
        <div className="px-4 pt-4 h-[65vh]">
          <div className="rounded-3xl overflow-hidden border border-border/60 shadow-sm h-full">
          <img src="/LOGIN-IMAGE.png" alt="Flow Finance" className="w-full h-full object-cover object-top" />
        </div>
      </div>

      {/* Bottom section - buttons */}
      <div className="bg-background px-6 pt-8 pb-10 space-y-3">
    
        {/* Continue with Email */}
        <button
          onClick={() => setMode("login")}
          className="w-full py-3.5 rounded-2xl bg-[#A8FF3E] text-black text-sm font-bold hover:bg-[#9AEF30] transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Mail className="h-4 w-4" />
          Log in with Email
        </button>

        {/* Continue with Google */}
        <button
          onClick={handleGoogle}
          disabled={isGoogleLoading}
          className="w-full py-3.5 rounded-2xl border border-border bg-background text-sm font-semibold hover:bg-muted transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isGoogleLoading ? "Connecting..." : "Log in with Google"}
        </button>

        {/* Already have account */}
        <p className="text-center text-sm text-muted-foreground pt-1">
        Don't have an account?{" "}
<button onClick={() => { setPreviousMode("home"); setMode("register"); }} className="font-semibold text-foreground">
  Register
</button>
        </p>
      </div>
    </div>
  );
}
