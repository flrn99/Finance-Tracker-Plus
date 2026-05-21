import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ListOrdered, 
  Tags, 
  Download,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: ListOrdered },
    { href: "/categories", label: "Categories", icon: Tags },
    { href: "/export", label: "Export", icon: Download },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-serif font-bold text-sidebar-foreground">FinanceFlow</h1>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href}>
                <span className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Link href="/transactions/new">
            <Button className="w-full justify-start gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New Transaction
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile nav could go here */}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
