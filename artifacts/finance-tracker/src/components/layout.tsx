import { Link, useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ListOrdered,
  Tags,
  Plus,
  DollarSign,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Capacitor } from "@capacitor/core";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mide el nav real y expone su altura como CSS variable
  useEffect(() => {
    const update = () => {
      if (!navRef.current) return;
      const h = navRef.current.offsetHeight;
      document.documentElement.style.setProperty("--nav-height", `${h}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Detecta scroll — encoge al bajar, vuelve al parar o subir
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const current = el.scrollTop;
      const delta = current - lastScrollY.current;

      if (current < 40) {
        // Cerca del top — siempre expandido
        setScrolled(false);
      } else if (delta > 2) {
        // Scrolleando hacia abajo — encoger
        setScrolled(true);
      } else if (delta < -2) {
        // Scrolleando hacia arriba — expandir
        setScrolled(false);
      }

      lastScrollY.current = current;

      // Si se para — expandir después de 800ms
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setScrolled(false);
      }, 800);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  const isIOS = Capacitor.getPlatform() === "ios";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* Sidebar — desktop only */}
      <aside className="w-60 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-sidebar-primary flex items-center justify-center shrink-0">
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer text-sm font-medium",
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen relative">
        {/* Fade top */}
        <div
          className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            height: 'calc(env(safe-area-inset-top) + 8px)',
            background: 'linear-gradient(to bottom, hsl(var(--background)) 60%, transparent)',
          }}
        />
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain p-4 md:pt-8 md:pb-8 md:p-8"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
            paddingBottom: isIOS ? '110px' : '6rem',
          }}
        >
          <div className="max-w-6xl mx-auto min-h-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation — liquid glass floating pill */}
      <nav
        ref={navRef}
        className="md:hidden fixed z-40 flex items-center"
        style={{
          bottom: isIOS ? 'env(safe-area-inset-bottom, 8px)' : 'calc(env(safe-area-inset-bottom) + 24px)',
          left: '50%',
          width: scrolled ? 'calc(100% - 64px)' : 'calc(100% - 40px)',
          maxWidth: scrolled ? '360px' : '420px',
          borderRadius: '999px',
          padding: scrolled ? '7px 12px' : '10px 16px',
          gap: scrolled ? '0px' : '4px',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          background: scrolled
            ? 'hsl(var(--card) / 0.75)'
            : 'hsl(var(--card) / 0.55)',
          border: '1px solid hsl(var(--foreground) / 0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 hsl(var(--foreground) / 0.06), inset 0 -1px 0 hsl(var(--background) / 0.2)',
          transform: 'translateX(-50%)',
          transition: 'width 0.4s cubic-bezier(0.25,0.46,0.45,0.94), max-width 0.4s cubic-bezier(0.25,0.46,0.45,0.94), padding 0.4s cubic-bezier(0.25,0.46,0.45,0.94), gap 0.4s cubic-bezier(0.25,0.46,0.45,0.94), background 0.4s ease',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1 min-w-0">
              <span
                className="flex flex-col items-center justify-center gap-1 w-full cursor-pointer"
                style={{ transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)' }}
              >
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{
                    padding: isActive ? (scrolled ? '5px 14px' : '6px 16px') : (scrolled ? '5px' : '6px'),
                    background: isActive && item.href === "/insights"
                      ? 'rgba(14,165,233,0.18)'
                      : isActive
                      ? 'hsl(var(--foreground) / 0.1)'
                      : 'transparent',
                    boxShadow: isActive
                      ? 'inset 0 1px 1px hsl(var(--foreground) / 0.08), inset 0 -1px 1px hsl(var(--background) / 0.15)'
                      : 'none',
                    transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
                  }}
                >
                  <Icon
                    style={{
                      width: scrolled ? '22px' : '26px',
                      height: scrolled ? '22px' : '26px',
                      strokeWidth: isActive ? 2.5 : 1.8,
                      color: isActive && item.href === "/insights"
                        ? '#0ea5e9'
                        : isActive
                        ? 'hsl(var(--foreground))'
                        : 'hsl(var(--muted-foreground) / 0.6)',
                      transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
                    }}
                  />
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
