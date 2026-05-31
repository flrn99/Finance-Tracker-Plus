import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import { CurrencyProvider } from "@/lib/currency-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Login from "@/pages/login";
import { supabase } from "@/lib/supabase";

// Pages
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import NewTransaction from "@/pages/new-transaction";
import Categories from "@/pages/categories";
import Export from "@/pages/export";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
      {/* <ScrollToTop /> */}
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/transactions/new" component={NewTransaction} />
        <Route path="/categories" component={Categories} />
        <Route path="/export" component={Export} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ProtectedRouter() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user) navigate("/");
  }, [user]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-sidebar-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!user) return <Login />;

  return <Router />;
}

function App() {
  useEffect(() => {
    // Handle deep link callback from Google OAuth
    const handleDeepLink = async (url: string) => {
      if (url.includes("login-callback")) {
        const hashParams = new URLSearchParams(url.split("#")[1] || url.split("?")[1] || "");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
const { Browser } = await import("@capacitor/browser");
await Browser.close();
        }
      }
    };

    // Listen for app URL opens (Capacitor deep links)
    const setupDeepLink = async () => {
      try {
        const { App } = await import("@capacitor/app");
        App.addListener("appUrlOpen", async (data: { url: string }) => {
          await handleDeepLink(data.url);
        });
      } catch {
        // Not in Capacitor environment
      }
    };

    setupDeepLink();

    // Also handle web hash-based redirects
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
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <ProtectedRouter />
              </WouterRouter>
              <Toaster />
            </AuthProvider>
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
