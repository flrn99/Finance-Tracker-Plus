import { useState, useEffect, useId } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LogoMark } from "@/components/logo-mark";

type Mode = "login" | "register" | "forgot";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/** Input de línea (label arriba, subrayado abajo) — reemplaza los inputs con
 * caja/borde completo de la versión anterior. `useId` liga label+input de
 * verdad (el audit encontró que los inputs no tenían label accesible). */
function UnderlineField({
  label, right, id: idProp, className, ...props
}: { label: string; right?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  return (
    <div>
      <label htmlFor={id} className="block text-[0.68rem] font-bold text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2 transition-colors focus-within:border-foreground">
        <input
          id={id}
          {...props}
          // text-base (16px), no text-sm (14px): en iOS, Safari/WKWebView hace
          // zoom automático al enfocar cualquier input con font-size < 16px —
          // eso es el "zoom raro" al tocar Email/Password. Es el umbral real,
          // no un valor arbitrario.
          className={cn("flex-1 min-w-0 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-medium", className)}
        />
        {right}
      </div>
    </div>
  );
}

function ForgotScreen({ onBack, isLoading, email, setEmail, onSubmit }: {
  onBack: () => void;
  isLoading: boolean;
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 max-w-sm w-full mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1">We'll send a reset link to your email.</p>
        </div>
        <UnderlineField
          label="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
          value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full py-3.5 rounded-full bg-foreground text-background text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading ? "Sending..." : "Send reset link"}
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [previousMode, setPreviousMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const handler = App.addListener("backButton", () => {
      if (mode === "forgot") setMode(previousMode);
      else App.exitApp();
    });
    return () => { handler.then((h) => h.remove()); };
  }, [mode, previousMode]);

  const handleSubmit = async () => {
    if (!email || !password) { toast({ title: "Please fill in all fields", variant: "destructive" }); return; }
    setIsLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName, name: firstName } } });
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
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        const { Browser } = await import("@capacitor/browser");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: "com.florian.financetracker://login-callback", skipBrowserRedirect: true, queryParams: { prompt: "consent" } },
        });
        if (error) throw error;
        if (data.url) await Browser.open({ url: data.url });
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin, queryParams: { prompt: "consent" } },
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsGoogleLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) { toast({ title: "Enter your email", variant: "destructive" }); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "com.florian.financetracker://login-callback?type=recovery" });
    setIsLoading(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Email sent!", description: "Check your inbox for the reset link." });
    setMode("login");
  };

  if (mode === "forgot") {
    return <ForgotScreen onBack={() => setMode(previousMode)} isLoading={isLoading} email={email} setEmail={setEmail} onSubmit={handleForgot} />;
  }

  const isRegister = mode === "register";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center md:p-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="w-full md:max-w-4xl md:bg-card md:rounded-[32px] md:shadow-2xl md:overflow-hidden md:grid md:grid-cols-2">
        {/* Panel de marca — solo en pantallas anchas, en mobile no hay espacio de imagen */}
        <div
          className="hidden md:flex flex-col items-start justify-center p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #14140F 0%, #1c1c14 100%)" }}
        >
          <div
            aria-hidden="true"
            className="absolute -inset-[40%]"
            style={{ background: "radial-gradient(circle at 30% 25%, rgba(202,250,1,0.18), transparent 55%), radial-gradient(circle at 75% 75%, rgba(52,211,153,0.14), transparent 55%)" }}
          />
          <LogoMark height={64} className="self-start mb-4" />
          <p className="relative text-white/45 text-sm leading-relaxed">Track every peso,<br />every day.</p>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm mx-auto px-6 py-12 md:max-w-none md:mx-0 md:p-12 flex flex-col justify-center">
          <LogoMark height={48} className="self-start mb-5 md:hidden" />

          <div className="relative h-[2.6rem] overflow-hidden mb-1">
            <h1
              className={cn(
                "font-display text-2xl text-foreground absolute inset-0 transition-[transform,opacity] duration-[450ms] ease-out",
                isRegister ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
              )}
            >
              Welcome back!
            </h1>
            <h1
              className={cn(
                "font-display text-2xl text-foreground absolute inset-0 transition-[transform,opacity] duration-[450ms] ease-out",
                isRegister ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
              )}
            >
              Create account
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-7">
            {isRegister ? "Start tracking your finances" : "Enter your details below"}
          </p>

          <div className="space-y-4">
            {isRegister && (
              <UnderlineField
                label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name" autoCapitalize="words"
              />
            )}
            <UnderlineField
              label="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <UnderlineField
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="p-2 -m-2 text-muted-foreground shrink-0"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </div>

          <div className="flex justify-end mt-2 mb-6 h-4">
            {!isRegister && (
              <button onClick={() => { setPreviousMode(mode); setMode("forgot"); }} className="text-xs text-muted-foreground">
                Forgot password?
              </button>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-3.5 rounded-full bg-foreground text-background text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : isRegister ? "Create Account" : "Log in"}
          </button>
          <button
            onClick={handleGoogle}
            disabled={isGoogleLoading}
            className="w-full py-3 rounded-full bg-muted text-sm font-semibold mt-2.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <GoogleIcon />
            {isGoogleLoading ? "Connecting..." : "Log in with Google"}
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isRegister ? "Already a member? " : "New here? "}
            <button onClick={() => setMode(isRegister ? "login" : "register")} className="font-bold text-foreground">
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
