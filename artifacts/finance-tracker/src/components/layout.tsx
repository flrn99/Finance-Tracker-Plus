import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ListOrdered,
  Tags,
  Download,
  Plus,
  DollarSign,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* Sidebar — desktop only */}
      <aside className="w-60 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-serif font-bold text-sidebar-foreground tracking-tight">FinanceFlow</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm font-medium",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href="/transactions/new">
            <Button className="w-full gap-2 bg-sidebar-primary hover:bg-sidebar-primary/90 text-white shadow-sm">
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      {/* Main Content */}
<main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen relative">
  {/* Fade top */}
  <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none" style={{ height: 'calc(env(safe-area-inset-top) + 8px)', background: 'linear-gradient(to bottom, hsl(var(--background)) 60%, transparent)' }} />
  <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-24 md:pt-8 md:pb-8 md:p-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
    <div className="max-w-6xl mx-auto min-h-full">
      {children}
    </div>
  </div>
</main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar rounded-t-3xl flex items-center px-2 py-6 shadow-[0_-4px_24px_rgba(0,0,0,0.18),0_-1px_0px_rgba(0,0,0,0.08)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
  {navItems.map((item) => {
    const Icon = item.icon;
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    return (
      <Link key={item.href} href={item.href} className="flex-1 min-w-0">
        <span className="flex flex-col items-center justify-center gap-1 w-full cursor-pointer transition-all">
          <Icon className={cn(
            "shrink-0 transition-all",
            isActive ? "h-6 w-6 text-[#7DD900] stroke-[2.5]" : "h-6 w-6 text-sidebar-foreground/40"
          )} />
          <span className={cn(
            "truncate w-full text-center transition-all",
            isActive ? "text-[11px] font-bold text-[#7DD900]" : "text-[10px] font-medium text-sidebar-foreground/40"
          )}>{item.label}</span>
        </span>
      </Link>
    );
  })}
  </nav>  
    </div>
  );
}
