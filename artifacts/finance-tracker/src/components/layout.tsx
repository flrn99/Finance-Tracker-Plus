import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ListOrdered,
  Tags,
  Download,
  Plus,
  DollarSign,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/export", label: "Export", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-sidebar sticky top-0 z-10">
          <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <DollarSign className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-serif font-bold text-sidebar-foreground">FinanceFlow</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-8 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-sidebar-border flex items-stretch">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1 min-w-0">
              <span
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 w-full cursor-pointer transition-colors",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/40 hover:text-sidebar-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5]")} />
                <span className="text-[9px] font-semibold truncate w-full text-center px-0.5">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
