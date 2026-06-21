import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type Mode = "home" | "login" | "register" | "forgot";

// Slides placeholder — reemplazar con tus imágenes reales
const SLIDES = [
  {
    image: "/LOGIN-IMAGE.png",
    title: "Your Finance\nJourney Starts\nNow.",
    sub: "Track every peso, every day.",
  },
  {
    image: "/LOGIN-IMAGE.png",
    title: "Know Where\nYour Money\nGoes.",
    sub: "Smart insights powered by AI.",
  },
  {
    image: "/LOGIN-IMAGE.png",
    title: "Import &\nOrganize\nInstantly.",
    sub: "Upload your bank statement in seconds.",
  },
];

function HomeScreen({ onLogin, onGoogle, onRegister, isGoogleLoading }: {
  onLogin: () => void;
  onGoogle: () => void;
  onRegister: () => void;
  isGoogleLoading: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % SLIDES.length);
    }, 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % SLIDES.length);
    }, 3500);
  };

  const goTo = (i: number) => { setCurrent(i); resetTimer(); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goTo((current + 1) % SLIDES.length);
      else goTo((current - 1 + SLIDES.length) % SLIDES.length);
    }
  };

  const slide = SLIDES[current];

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Slide card */}
      <div className="px-4 pt-4" style={{ height: "58vh" }}>
        <div
          className="rounded-2xl overflow-hidden h-full relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={slide.image}
            alt="Flow Finance"
            className="w-full h-full object-cover object-top transition-opacity duration-500"
          />
          <div className="absolute bottom-0 left-0 right-0 p-6" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
            <h1 className="text-white font-serif font-bold text-3xl leading-tight whitespace-pre-line" style={{ textTransform: "none" }}>{slide.title}</h1>
            <p className="text-white/80 text-sm mt-1">{slide.sub}</p>
          </div>
          <div className="absolute bottom-4 right-5 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "rounded-full transition-all",
                  i === current ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-6 pt-6 pb-10 space-y-3">
        <button
          onClick={onLogin}
          className="w-full py-3.5 rounded-2xl bg-[#A8FF3E] text-black text-sm font-bold transition-all flex items-center justify-center gap-2 border-0"
        >
          <Mail className="h-4 w-4" />
          Continue with Email
        </button>

        <button
          onClick={onGoogle}
          disabled={isGoogleLoading}
          className="w-full py-3.5 rounded-2xl border border-border bg-background text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-1">
          Don't have an account?{" "}
          <button onClick={onRegister} className="font-bold text-foreground">Register</button>
        </p>
      </div>
    </div>
  );
}

function LoginForm({ mode, onBack, onForgot, onRegister, onSubmit, isLoading,
  email, setEmail, password, setPassword, firstName, setFirstName,
  showPassword, setShowPassword,
}: {
  mode: "login" | "register";
  onBack: () => void;
  onForgot: () => void;
  onRegister: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  firstName: string; setFirstName: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Back */}
      <div className="px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 max-w-sm w-full mx-auto space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground normal-case" style={{ textTransform: "none" }}>
            {mode === "login" ? "Welcome\nback" : "Create\naccount"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Sign in to Flow Finance" : "Start tracking your finances"}
          </p>
        </div>

        <div className="space-y-3">
          {/* First name — register only */}
          {mode === "register" && (
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
            />
          )}

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onSubmit()}
              className="w-full pl-10 pr-12 py-3.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Forgot */}
          {mode === "login" && (
            <button onClick={onForgot} className="text-xs text-muted-foreground underline w-full text-right">
              Forgot password?
            </button>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full py-3.5 rounded-2xl bg-[#A8FF3E] text-black text-sm font-bold transition-all disabled:opacity-60 border-0"
        >
          {isLoading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Switch mode */}
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={onRegister} className="font-bold text-foreground">
            {mode === "login" ? "Register" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

function ForgotForm({ onBack, isLoading, email, setEmail, onSubmit }: {
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
          <h1 className="text-3xl font-serif font-bold text-foreground normal-case" style={{ textTransform: "none" }}>Reset\npassword</h1>
          <p className="text-sm text-muted-foreground mt-1">We'll send a reset link to your email.</p>
        </div>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full py-3.5 rounded-2xl bg-[#A8FF3E] text-black text-sm font-bold transition-all disabled:opacity-60 border-0"
        >
          {isLoading ? "Sending..." : "Send reset link"}
        </button>
      </div>
    </div>
  );
}

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

  if (mode === "home") {
    return <HomeScreen onLogin={() => setMode("login")} onGoogle={handleGoogle} onRegister={() => { setPreviousMode("home"); setMode("register"); }} isGoogleLoading={isGoogleLoading} />;
  }

  if (mode === "forgot") {
    return <ForgotForm onBack={() => setMode("login")} isLoading={isLoading} email={email} setEmail={setEmail} onSubmit={handleForgot} />;
  }

  return (
    <LoginForm
      mode={mode as "login" | "register"}
      onBack={() => setMode(mode === "register" ? previousMode : "home")}
      onForgot={() => setMode("forgot")}
      onRegister={() => {
        if (mode === "login") { setPreviousMode("login"); setMode("register"); }
        else setMode("login");
      }}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      email={email} setEmail={setEmail}
      password={password} setPassword={setPassword}
      firstName={firstName} setFirstName={setFirstName}
      showPassword={showPassword} setShowPassword={setShowPassword}
    />
  );
}
