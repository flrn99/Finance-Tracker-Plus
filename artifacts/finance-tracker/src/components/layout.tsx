import { Link, useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  ListOrdered,
  Tags,
  Plus,
  DollarSign,
  Sparkles,
  Palette,
  Download,
  Settings,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useCurrency, type Currency, CURRENCY_INFO } from "@/lib/currency-context";
import { ExportPanel } from "@/pages/export";
import { Capacitor } from "@capacitor/core";

interface LayoutProps {
  children: React.ReactNode;
}

/** Target con flecha — el ícono de Goals */
function TargetArrowIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M12 7a5 5 0 1 0 5 5" />
      <path d="M13 3.055A9 9 0 1 0 20.945 11" />
      <path d="M15 6v3h3l3-3h-3V3z" />
      <path d="M15 9l-3 3" />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ListOrdered },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: TargetArrowIcon },
  { href: "/categories", label: "Categories", icon: Tags },
];

/** Mini popup centrado para acciones rápidas del menú de perfil */
function QuickPopup({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 animate-in fade-in-0 duration-200" />
      <div
        className={cn(
          "relative w-full bg-card rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-4 max-h-[85dvh] overflow-y-auto",
          wide ? "max-w-md" : "max-w-xs"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-sm uppercase tracking-widest">{title}</p>
          <button onClick={onClose} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
            <X className="h-3 w-3" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProfileMenu() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<null | "currency" | "theme" | "export">(null);
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [avatar, setAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem("ff-avatar"); } catch { return null; }
  });

  // Se actualiza al instante cuando cambias el avatar en settings
  useEffect(() => {
    const sync = () => {
      try { setAvatar(localStorage.getItem("ff-avatar")); } catch {}
    };
    window.addEventListener("ff-avatar-changed", sync);
    return () => window.removeEventListener("ff-avatar-changed", sync);
  }, []);

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  // En settings no tiene sentido mostrar el avatar/dropdown — ya estás ahí
  if (location.startsWith("/settings")) return null;

  const themeOptions: { value: Theme; label: string; icon: any }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const menuItems = [
    {
      label: "Display Currency",
      icon: DollarSign,
      right: currency,
      action: () => { setOpen(false); setPopup("currency"); },
    },
    {
      label: "Theme",
      icon: Palette,
      right: theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System",
      action: () => { setOpen(false); setPopup("theme"); },
    },
    {
      label: "Export to Excel",
      icon: Download,
      action: () => { setOpen(false); setPopup("export"); },
    },
    {
      label: "All Settings",
      icon: Settings,
      action: () => { setOpen(false); navigate("/settings"); },
    },
  ];

  return (
    <>
      {/* Avatar button — flotante arriba a la derecha en todas las páginas */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-40 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform overflow-hidden"
        style={{
          top: "calc(env(safe-area-inset-top) + 10px)",
          right: "16px",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          background: "hsl(var(--card) / 0.7)",
          border: "1px solid hsl(var(--foreground) / 0.08)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12), inset 0 1px 0 hsl(var(--foreground) / 0.06)",
        }}
      >
        {avatar === "male" || avatar === "female" ? (
          <img src={`/${avatar}.png`} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-[#7DD900]">{initial}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-56 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              top: "calc(env(safe-area-inset-top) + 56px)",
              right: "16px",
              backdropFilter: "blur(24px) saturate(1.8)",
              WebkitBackdropFilter: "blur(24px) saturate(1.8)",
              background: "hsl(var(--card) / 0.92)",
              border: "1px solid hsl(var(--foreground) / 0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            {menuItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left",
                    i > 0 && "border-t border-border/50"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.right && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#A8FF3E] text-black">{item.right}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Popup: moneda */}
      {popup === "currency" && (
        <QuickPopup title="Display Currency" onClose={() => setPopup(null)}>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {(Object.keys(CURRENCY_INFO) as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => { setCurrency(c); setPopup(null); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  currency === c ? "bg-[#A8FF3E] text-black font-bold" : "hover:bg-muted"
                )}
              >
                {CURRENCY_INFO[c].label}
              </button>
            ))}
          </div>
        </QuickPopup>
      )}

      {/* Popup: tema */}
      {popup === "theme" && (
        <QuickPopup title="Theme" onClose={() => setPopup(null)}>
          <div className="space-y-1">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => { setTheme(opt.value); setPopup(null); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    theme === opt.value ? "bg-[#A8FF3E] text-black font-bold" : "hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </QuickPopup>
      )}
      {/* Popup: export */}
      {popup === "export" && (
        <QuickPopup title="Export to Excel" onClose={() => setPopup(null)} wide>
          <div className="[&>div]:bg-transparent [&>div]:shadow-none">
            <ExportPanel onDone={() => setPopup(null)} />
          </div>
        </QuickPopup>
      )}
    </>
  );
}

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
        setScrolled(false);
      } else if (delta > 2) {
        setScrolled(true);
      } else if (delta < -2) {
        setScrolled(false);
      }

      lastScrollY.current = current;

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
            paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
            paddingBottom: isIOS ? '110px' : '6rem',
          }}
        >
          <div className="max-w-6xl mx-auto min-h-full">
            {children}
          </div>
        </div>
      </main>

      {/* Avatar de perfil — visible en todas las páginas */}
      <ProfileMenu />

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
