import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ListOrdered,
  Tags,
  Download,
  Plus,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency, type Currency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/export", label: "Export", icon: Download },
];

function CurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  const options: { value: Currency; label: string }[] = [
    { value: "USD", label: "$ USD" },
    { value: "GTQ", label: "Q GTQ" },
  ];
  return (
    <div className={cn("flex rounded-lg border border-border overflow-hidden text-xs font-medium", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setCurrency(opt.value)}
          className={cn(
            "flex-1 px-2.5 py-1.5 transition-colors",
            currency === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar — desktop only */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-serif text-sidebar-foreground font-bold">FLRN TRACKER</h1>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-3 border-t border-sidebar-border">
          {/* Currency toggle */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 px-1">
              <DollarSign className="h-3 w-3" />
              Currency
            </p>
            <CurrencyToggle />
          </div>
          <Link href="/transactions/new">
            <Button className="w-full justify-start gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </Link>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar sticky top-0 z-10">
          <h1 className="text-lg font-serif font-bold">FinanceFlow</h1>
          <CurrencyToggle className="w-36" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-8 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-sidebar border-t border-sidebar-border flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <span
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 w-full cursor-pointer transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </span>
            </Link>
          );
        })}
        {/* Quick add button in the center of bottom nav */}
        <Link href="/transactions/new" className="flex-1">
          <span className="flex flex-col items-center justify-center gap-0.5 py-2 w-full cursor-pointer">
            <span className="bg-primary text-primary-foreground rounded-full p-1.5">
              <Plus className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">Add</span>
          </span>
        </Link>
      </nav>
    </div>
  );
}
