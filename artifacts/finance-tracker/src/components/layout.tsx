import { Link, useLocation } from "wouter";
import { useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Tags,
  Plus,
  DollarSign,
  Sparkles,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { goalsQueryOptions, habitsQueryOptions } from "@/pages/goals";

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
  { href: "/goals", label: "Goals", icon: TargetArrowIcon },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Avatar de perfil — ya no flota arriba de cada página (ese ícono duplicaba
 * el de Settings del nav). Ahora vive únicamente acá: reemplaza al ícono
 * genérico del item "Settings" en el nav, así el nav muestra la foto/inicial
 * real en vez de un gear sin identidad. */
function AvatarGlyph({ avatar, initial, size }: { avatar: string | null; initial: string; size: number }) {
  if (avatar === "male" || avatar === "female") {
    return (
      <span className="rounded-full overflow-hidden shrink-0 block" style={{ width: size, height: size }}>
        <img src={`/${avatar}.png`} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-[#00432C] dark:text-[#6EE7B7]"
      style={{ width: size, height: size, background: "hsl(var(--foreground) / 0.08)", fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Transactions es la única página de "detalle" a la que se entra desde otra
  // pestaña (All transactions) sin destino propio en el nav — Settings ahora
  // sí tiene su propio ícono, así que ya puede quedar activo ahí.
  const hideBottomNav = location.startsWith("/transactions");

  // Prefetch de Goals — cuando el usuario llegue a la pestaña, ya cargo
  useEffect(() => {
    queryClient.prefetchQuery(goalsQueryOptions).catch(() => {});
    queryClient.prefetchQuery(habitsQueryOptions).catch(() => {});
  }, [queryClient]);
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Avatar del perfil — vive acá porque ahora se pinta en el ícono de
  // "Settings" del nav en vez de flotar arriba de cada página.
  const [avatar, setAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem("ff-avatar"); } catch { return null; }
  });
  useEffect(() => {
    const sync = () => {
      try { setAvatar(localStorage.getItem("ff-avatar")); } catch {}
    };
    window.addEventListener("ff-avatar-changed", sync);
    return () => window.removeEventListener("ff-avatar-changed", sync);
  }, []);
  const avatarInitial = (user?.email?.[0] ?? "?").toUpperCase();

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

  // Swipe entre las páginas principales del nav — solo en las 5 pestañas de base,
  // se ignora si hay un modal abierto encima (mismo body-scroll-lock que ya usan EntrySheet/VoiceCapture)
  const pageSwipeStart = useRef<{ x: number; y: number } | null>(null);

  function handlePageSwipeStart(e: React.TouchEvent) {
    if (document.body.style.overflow === "hidden") { pageSwipeStart.current = null; return; }
    const t = e.touches[0];
    pageSwipeStart.current = { x: t.clientX, y: t.clientY };
  }

  function handlePageSwipeEnd(e: React.TouchEvent) {
    const start = pageSwipeStart.current;
    pageSwipeStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const currentIndex = navItems.findIndex((item) =>
      location === item.href || (item.href !== "/" && location.startsWith(item.href))
    );
    if (currentIndex === -1) return;

    if (dx < 0 && currentIndex < navItems.length - 1) {
      navigate(navItems[currentIndex + 1].href, { replace: true });
    } else if (dx > 0 && currentIndex > 0) {
      navigate(navItems[currentIndex - 1].href, { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      {/* Sidebar — desktop only */}
      <aside className="w-60 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-sidebar-primary flex items-center justify-center shrink-0">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-base text-sidebar-foreground tracking-tight">Flow!</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} replace>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer text-sm font-medium",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  {item.href === "/settings" ? (
                    <AvatarGlyph avatar={avatar} initial={avatarInitial} size={16} />
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href="/transactions">
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
          data-app-scroll
          className="flex-1 overflow-y-auto overscroll-contain p-4 md:pt-8 md:pb-8 md:p-8"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 24px)',
            paddingBottom: hideBottomNav ? 'calc(env(safe-area-inset-bottom) + 24px)' : (isIOS ? '110px' : '6rem'),
          }}
          onTouchStart={handlePageSwipeStart}
          onTouchEnd={handlePageSwipeEnd}
        >
          <div className="max-w-6xl mx-auto min-h-full relative">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile bottom navigation — liquid glass floating pill */}
      {!hideBottomNav && (
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
          // El blur+saturate de fondo recalcula en cada frame mientras width/padding
          // animan (400ms cada vez que cruza el umbral de scroll) — contain aísla el
          // repintado a este nodo en vez de invalidar layout del padre, will-change
          // le avisa al compositor con anticipación cuáles props van a animar.
          contain: 'layout paint',
          willChange: 'width, max-width, padding, gap',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex-1 min-w-0" replace>
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
                  {item.href === "/settings" ? (
                    <AvatarGlyph avatar={avatar} initial={avatarInitial} size={scrolled ? 22 : 26} />
                  ) : (
                    <Icon
                      style={{
                        width: scrolled ? '22px' : '26px',
                        height: scrolled ? '22px' : '26px',
                        strokeWidth: isActive ? 2.5 : 1.8,
                        color: isActive && item.href === "/insights"
                          ? '#0ea5e9'
                          : isActive
                          ? 'hsl(var(--foreground))'
                          : 'hsl(var(--muted-foreground) / 0.85)',
                        transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
                      }}
                    />
                  )}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
      )}
    </div>
  );
}
