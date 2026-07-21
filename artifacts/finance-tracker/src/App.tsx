import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import { CurrencyProvider } from "@/lib/currency-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { BiometricProvider, useBiometric } from "@/lib/biometric-context";
import BiometricLock from "@/components/biometric-lock";
import Login from "@/pages/login";
import { supabase } from "@/lib/supabase";
import ResetPassword from "@/pages/reset-password";
import Onboarding from "@/pages/onboarding";

// Pages
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Categories from "@/pages/categories";
import Export from "@/pages/export";
import Insights from "@/pages/insights";
import Goals from "@/pages/goals";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

let globalSetIsResetting: ((v: boolean) => void) | null = null;

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/categories" component={Categories} />
        <Route path="/export" component={Export} />
        <Route path="/insights" component={Insights} />
        <Route path="/goals" component={Goals} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ProtectedRouter() {
  const { user, isLoading, isNewAccount, acknowledgeOnboarded } = useAuth();
  const { isLocked } = useBiometric();
  const [, navigate] = useLocation();
  const [isResetting, setIsResetting] = useState(false);
  const wasAuthenticated = useRef(false);
  const wasLocked = useRef(false);

  useEffect(() => {
    globalSetIsResetting = setIsResetting;
    return () => { globalSetIsResetting = null; };
  }, []);

  // Siempre aterriza en el Dashboard tras un login real — sin esto, si cerraste
  // sesión desde /settings (el lugar más común para hacerlo), wouter conserva
  // ese path y al volver a entrar te deja ahí en vez de en "/".
  useEffect(() => {
    if (user && !wasAuthenticated.current) {
      wasAuthenticated.current = true;
      navigate("/", { replace: true });
    }
    if (!user) wasAuthenticated.current = false;
  }, [user, navigate]);

  // Mismo problema que el login: el biometric lock no toca `user`, así que wouter
  // conserva el path de antes de bloquearse (ej. Transactions, si el timeout de
  // 5min agarró a la app ahí) y el desbloqueo te devolvía a esa página en vez del
  // Dashboard. Se resetea al Dashboard cada vez que el lock pasa de abierto a cerrado.
  useEffect(() => {
    if (isLocked) wasLocked.current = true;
    else if (wasLocked.current) {
      wasLocked.current = false;
      navigate("/", { replace: true });
    }
  }, [isLocked, navigate]);

  if (isResetting && user) return <ResetPassword onDone={() => setIsResetting(false)} />;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-sidebar-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return <Login />;

  // Show biometric lock screen on top of the app
  if (isLocked) return <BiometricLock />;

  // Cuenta recién creada (sin categorías todavía) — setup de una sola vez
  // antes de entrar al Dashboard.
  if (isNewAccount) return <Onboarding onDone={acknowledgeOnboarded} />;

  return <Router />;
}

function App() {
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (url.includes("login-callback")) {
        const hashParams = new URLSearchParams(url.split("#")[1] || url.split("?")[1] || "");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (type === "recovery" && accessToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? "" });
          if (globalSetIsResetting) globalSetIsResetting(true);
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close();
          } catch {}
          return;
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close();
          } catch {}
        }
      }
    };

    const setupDeepLink = async () => {
      try {
        const { App } = await import("@capacitor/app");
        App.addListener("appUrlOpen", async (data: { url: string }) => {
          await handleDeepLink(data.url);
        });
      } catch {}
    };

    setupDeepLink();

    if (window.location.hash.includes("access_token")) {
      handleDeepLink(window.location.href);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <TooltipProvider>
            <AuthProvider>
              <BiometricProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <ProtectedRouter />
                </WouterRouter>
                <Toaster />
              </BiometricProvider>
            </AuthProvider>
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
