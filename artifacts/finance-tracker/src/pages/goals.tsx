import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, categoryTextColor } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCurrency, CURRENCY_INFO } from "@/lib/currency-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, X, Check, Pencil, Trash2, Flame, ChevronLeft, ChevronRight, ChevronDown,
  Target, PiggyBank, Wallet, Ban, Coffee, ShoppingBag, Utensils, Candy,
  Dumbbell, Cigarette, Beer, Car, Gamepad2, Shirt, Smartphone, Plane,
  Home, Gift, BookOpen, Music, CreditCard, Zap, Wifi, Landmark, Tv, Droplet,
  TrendingDown, TrendingUp,
} from "lucide-react";
import {
  useCreateTransaction,
  useCreateCategory,
  useListCategories,
  getListCategoriesQueryKey,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetMonthlyTrendQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

import { getApiUrl } from "@/lib/api-config";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(getApiUrl(`/api${path}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error ?? ""; } catch {}
    throw new Error(`${res.status}${detail ? `: ${detail}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  icon: string | null;
  color: string | null;
  createdAt: string;
}

// Exportadas para prefetch desde el layout — Goals carga en segundo plano al abrir la app
export const goalsQueryOptions = {
  queryKey: ["goals"] as const,
  queryFn: () => api<Goal[]>("/goals"),
  staleTime: 30_000,
};
export const habitsQueryOptions = {
  queryKey: ["habits"] as const,
  queryFn: () => api<Habit[]>("/habits"),
  staleTime: 30_000,
};
export const billsQueryOptions = {
  queryKey: ["bills"] as const,
  queryFn: () => api<Bill[]>("/bills"),
  staleTime: 30_000,
};

interface Habit {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: string;
  logs: string[];
  streak: number;
}

export interface Bill {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  type: "expense" | "income";
  day: number; // día del mes (1-31) en que se repite
  amount: number | null;
  categoryId: number | null;
  autoSave: boolean;
  createdAt: string;
  logs: string[]; // "YYYY-MM"
  paidThisMonth: boolean;
  linkedTransactionCount: number;
}

/* ------------------------------------------------------------------ */
/* Icons & colors                                                      */
/* ------------------------------------------------------------------ */

/** Precarga goals y habits al abrir la app — la pagina abre instantanea */
export function prefetchGoalsData(queryClient: QueryClient) {
  queryClient.prefetchQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") });
  queryClient.prefetchQuery({ queryKey: ["habits"], queryFn: () => api<Habit[]>("/habits") });
  queryClient.prefetchQuery({ queryKey: ["bills"], queryFn: () => api<Bill[]>("/bills") });
}

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  target: Target,
  piggybank: PiggyBank,
  wallet: Wallet,
  ban: Ban,
  coffee: Coffee,
  shoppingbag: ShoppingBag,
  utensils: Utensils,
  candy: Candy,
  dumbbell: Dumbbell,
  cigarette: Cigarette,
  beer: Beer,
  car: Car,
  gamepad: Gamepad2,
  shirt: Shirt,
  smartphone: Smartphone,
  plane: Plane,
  home: Home,
  gift: Gift,
  book: BookOpen,
  music: Music,
  creditcard: CreditCard,
  zap: Zap,
  wifi: Wifi,
  landmark: Landmark,
  tv: Tv,
  droplet: Droplet,
};

// Listas curadas por feature — se solapan un poco a propósito (siguen siendo la
// misma "familia" del picker), pero cada una tiene su propio carácter en vez de
// compartir el mismo set de 20 íconos entre Goals/Habits/Bills.
const GOAL_ICON_KEYS = ["target", "piggybank", "wallet", "home", "plane", "car", "gift", "book", "music", "gamepad"];
const HABIT_ICON_KEYS = ["dumbbell", "coffee", "cigarette", "beer", "candy", "ban", "utensils", "shirt", "book", "music"];
const BILL_ICON_KEYS = ["creditcard", "home", "car", "smartphone", "wallet", "zap", "wifi", "landmark", "tv", "droplet"];

const COLOR_OPTIONS: { hex: string; name: string }[] = [
  { hex: "#FF4D4D", name: "Flow! Red" },
  { hex: "#00FF9C", name: "Flow! Green" },
  { hex: "#CAFA01", name: "Flow Green" },
  { hex: "#22c55e", name: "Matcha Rush" },
  { hex: "#14b8a6", name: "Caribbean Wave" },
  { hex: "#0ea5e9", name: "Miami Sky" },
  { hex: "#6366f1", name: "Midnight Neon" },
  { hex: "#a855f7", name: "Cosmic Grape" },
  { hex: "#ec4899", name: "Neon Flamingo" },
  { hex: "#ef4444", name: "Lava Burst" },
  { hex: "#f97316", name: "Sunset Blaze" },
  { hex: "#eab308", name: "Liquid Gold" },
];

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

// Mismo patrón que transactions.tsx/entry-sheet.tsx: cachea el módulo tras el primer import.
let hapticsModule: any = null;
const triggerHaptic = () => {
  if (hapticsModule) {
    hapticsModule.Haptics.impact({ style: hapticsModule.ImpactStyle.Light }).catch(() => {});
  } else {
    import("@capacitor/haptics").then((mod) => {
      hapticsModule = mod;
      mod.Haptics.impact({ style: mod.ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
  }
};

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1,234,567.89" -> "1.23M" — solo para números que ya no entrarían cómodos
 * en la caja en reposo; en foco siempre se edita el valor completo. */
function fmtAbbrev(n: number): string {
  const trim = (s: string) => s.replace(/\.?0+$/, "");
  // Number(...).toLocaleString() en vez de concatenar el string directo — si el
  // coeficiente llega a 1000+ (ej. mil millones), sigue llevando sus comas.
  if (n >= 1_000_000) return `${Number(trim((n / 1_000_000).toFixed(2))).toLocaleString()}M`;
  if (n >= 1_000) return `${Number(trim((n / 1_000).toFixed(1))).toLocaleString()}K`;
  return fmtMoney(n);
}

/** Muestra completo si entra cómodo, abreviado si no — el umbral es el mismo
 * punto en el que el número empezaba a desbordar la caja. */
function fmtAtRest(n: number): string {
  const full = fmtMoney(n);
  return full.length > 9 ? fmtAbbrev(n) : full;
}

/** Clase de tamaño según cantidad de caracteres a mostrar — más largo = texto más chico. */
function amountSizeClass(len: number): string {
  return len <= 9 ? "text-xl" : len <= 12 ? "text-lg" : "text-base";
}

/** Formatea lo que se escribe agregando comas de miles, respetando decimales en progreso */
function formatAmountInput(raw: string): string {
  // deja solo dígitos y un punto decimal
  let clean = raw.replace(/[^\d.]/g, "");
  const firstDot = clean.indexOf(".");
  if (firstDot !== -1) {
    clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, "");
  }
  if (clean === "" || clean === ".") return clean;
  const [intPart, decPart] = clean.split(".");
  const withCommas = intPart ? parseInt(intPart, 10).toLocaleString("en-US") : "";
  if (decPart !== undefined) {
    // máximo 2 decimales
    return `${withCommas}.${decPart.slice(0, 2)}`;
  }
  return withCommas;
}

/** Quita las comas para obtener el número real */
function parseAmountInput(formatted: string): number {
  const n = parseFloat(formatted.replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function todayKey(): string {
  return toKey(new Date());
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  return monthKeyOf(new Date());
}

/** "2026-07" -> "Jul 2026" — usa MONTHS, definido más abajo (seguro: solo se llama en render) */
function fmtMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function ordinal(n: number): string {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function ordinalSuffix(n: number): string {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

/** Próxima fecha en que cae un día del mes (1-31) — este mes si no pasó todavía,
 * si no el que viene. Usa MONTHS, definido más abajo (seguro: solo se llama en render). */
function nextDayOccurrence(day: number): string {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  const target = thisMonth >= now ? thisMonth : new Date(now.getFullYear(), now.getMonth() + 1, day);
  return `${MONTHS[target.getMonth()]} ${target.getDate()}`;
}

/** "2026-07" + 31 -> "2026-07-31" — clampeado al último día real del mes (ej. día
 * 31 elegido en un Flow cae el 30 en abril, no se desborda a mayo). */
function billDateFor(monthKey: string, day: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/** Ene→Dic de un año calendario fijo — la celda N SIEMPRE es el mes N (mayo = 5ta celda),
 * no una ventana relativa "últimos 12 meses" (eso confundía: el actual quedaba siempre última). */
function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function buildWeeks(numWeeks: number): string[][] {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0 = lunes
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  monday.setDate(monday.getDate() - (numWeeks - 1) * 7);

  const weeks: string[][] = [];
  const cursor = new Date(monday);
  for (let w = 0; w < numWeeks; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(toKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Racha en cliente — misma lógica que el backend, para optimistic updates */
function clientStreak(dates: Set<string>): number {
  const cursor = new Date();
  if (!dates.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(toKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function HabitIcon({ icon, className, style }: { icon: string | null; className?: string; style?: React.CSSProperties }) {
  const Comp = (icon && ICONS[icon]) || Target;
  return <Comp className={className} style={style} />;
}

/* ------------------------------------------------------------------ */
/* Modal flotante                                                      */
/* ------------------------------------------------------------------ */

function FloatingModal({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  // mounted/closing: deja jugar la animación de salida antes de desmontar de
  // un salto (antes "if (!open) return null" lo sacaba instantáneo, sin exit).
  // Mismo fix que category-form-modal.tsx — este FloatingModal es una copia
  // separada que no lo tenía.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    // Fallback por si animationend no dispara (interrupción rara) — en el caso
    // normal, onAnimationEnd del card de abajo desmonta antes de que esto corra.
    const t = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Bloquea el swipe de página del nav mientras el modal está abierto o cerrándose
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || undefined}
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{
        // respeta status bar y nav — el modal nunca los invade
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
      }}
      onClick={onClose}
    >
      <div
        className={cn("bg-black/80 duration-180", closing ? "animate-out fade-out" : "animate-in fade-in")}
        style={{
          position: "fixed",
          top: "-10vh", left: "-10vw", right: "-10vw", bottom: "-10vh",
          width: "120vw", height: "120dvh",
          animationFillMode: closing ? "forwards" : undefined,
        }}
      />
      <div
        className={cn(
          "relative w-full max-w-sm bg-card rounded-[36px] shadow-2xl duration-180 max-h-full overflow-y-auto",
          closing ? "animate-out fade-out slide-out-to-bottom-4" : "animate-in fade-in slide-in-from-bottom-4"
        )}
        style={{
          willChange: "transform, opacity",
          transform: "translate3d(0,0,0)",
          animationFillMode: closing ? "forwards" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => { if (closing) setMounted(false); }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-bold text-base">{title}</p>
          <button onClick={onClose} className="relative w-7 h-7 rounded-lg bg-muted flex items-center justify-center before:absolute before:-inset-2 before:content-['']">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pickers                                                             */
/* ------------------------------------------------------------------ */

function ColorSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = COLOR_OPTIONS.find((c) => c.hex === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-muted text-sm font-bold"
      >
        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: value }} />
        {current?.name ?? "Pick a color"}
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          {/* Cierra el popover al tocar afuera */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-20 rounded-2xl bg-card border border-border shadow-xl p-3.5">
            <div className="grid grid-cols-5 gap-2.5">
              {COLOR_OPTIONS.map((c) => {
                const active = c.hex === value;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => { onChange(c.hex); setOpen(false); }}
                    aria-label={c.name}
                    className="aspect-square rounded-full flex items-center justify-center transition-transform active:scale-90"
                    style={{ backgroundColor: c.hex, boxShadow: active ? "inset 0 0 0 2px rgba(0,0,0,0.45)" : undefined }}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IconPicker({
  value, onChange, color, iconKeys,
}: {
  value: string; onChange: (i: string) => void; color: string; iconKeys: string[];
}) {
  return (
    <div className="relative">
      <div
        className="flex gap-2 overflow-x-auto py-1 px-0.5"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {iconKeys.map((key) => {
          const Comp = ICONS[key];
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              aria-label={key}
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90",
                active ? "" : "bg-muted"
              )}
              style={active ? { backgroundColor: `${color}30`, boxShadow: `0 0 0 1.5px ${color}` } : undefined}
            >
              <Comp className="h-4 w-4" style={{ color: active ? color : undefined }} />
            </button>
          );
        })}
        {/* espacio final para que el último ícono no quede pegado al fade */}
        <div className="w-6 shrink-0" />
      </div>
      {/* Fade derecho — pista de que hay más íconos deslizando */}
      <div
        className="absolute top-0 right-0 h-full w-10 pointer-events-none rounded-r-lg"
        style={{ background: "linear-gradient(to right, transparent, hsl(var(--card)))" }}
      />
    </div>
  );
}

/** Input de monto grande y centrado — siempre muestra 2 decimales al perder foco
 * (no todos los pagos son montos redondos), pero no fuerza el ".00" mientras se
 * está tipeando (rompería poder escribir "450.50" natural). */
function AmountInput({
  value, onChange, symbol,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  symbol: string;
}) {
  const [text, setText] = useState(value ? fmtAtRest(value) : "");
  const lastValue = useRef(value);

  useEffect(() => {
    if (value !== lastValue.current) {
      setText(value ? fmtAtRest(value) : "");
      lastValue.current = value;
    }
  }, [value]);

  // El abreviado en reposo casi nunca necesita encoger ("1.23M" es corto) — pero
  // mientras se edita, el número completo sí puede ser largo y no entrar; ahí la
  // fuente encoge para que nunca se salga de la caja.
  const sizeClass = amountSizeClass(text.length);

  return (
    <div className="rounded-2xl bg-muted py-3.5 flex items-center justify-center gap-1 px-2 overflow-hidden">
      <span className={cn("font-bold text-muted-foreground shrink-0", sizeClass === "text-xl" ? "text-sm" : "text-xs")}>{symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Amount"
        placeholder="0.00"
        className={cn("font-number font-bold bg-transparent border-0 outline-none text-center min-w-0 w-full", sizeClass)}
        value={text}
        onFocus={(e) => {
          // Al foco se edita el valor real, no el abreviado
          if (value) setText(fmtMoney(value));
          e.target.select();
        }}
        onChange={(e) => {
          const formatted = formatAmountInput(e.target.value);
          setText(formatted);
          const n = parseAmountInput(formatted);
          lastValue.current = n;
          onChange(n);
        }}
        onBlur={() => {
          const n = parseAmountInput(text);
          setText(n ? fmtAtRest(n) : "");
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

const goalSchema = z.object({
  name: z.string().min(2, "Name is required"),
  targetAmount: z.coerce.number().positive("Must be greater than 0"),
  currentAmount: z.coerce.number().min(0, "Cannot be negative"),
  icon: z.string(),
  color: z.string(),
});
type GoalFormValues = z.infer<typeof goalSchema>;

const habitSchema = z.object({
  name: z.string().min(2, "Name is required"),
  icon: z.string(),
  color: z.string(),
});
type HabitFormValues = z.infer<typeof habitSchema>;

const billSchema = z.object({
  name: z.string().min(2, "Name is required"),
  icon: z.string(),
  color: z.string(),
  type: z.enum(["expense", "income"]),
  day: z.number().min(1).max(31),
  amount: z.coerce.number().min(0, "Cannot be negative").optional(),
  categoryId: z.coerce.number().optional(),
  autoSave: z.boolean().optional(),
});
type BillFormValues = z.infer<typeof billSchema>;

function GoalForm({
  form, onSubmit, isPending, submitLabel, symbol,
}: {
  form: ReturnType<typeof useForm<GoalFormValues>>;
  onSubmit: (data: GoalFormValues) => void;
  isPending: boolean;
  submitLabel: string;
  symbol: string;
}) {
  const color = form.watch("color");
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {/* Nombre escrito directo sobre el color elegido — misma línea que Bill */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: color }}>
          <div className="absolute -top-6 -right-4 w-16 h-16 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.28)" }} />
          <div className="relative px-3.5 py-3.5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => {
                const whiteReadable = categoryTextColor("#ffffff", color).toLowerCase() === "#ffffff";
                return (
                  <FormItem>
                    <FormControl>
                      <input
                        aria-label="Goal name"
                        placeholder="e.g. Vacation fund"
                        autoComplete="off"
                        className="w-full bg-transparent border-0 outline-none font-title text-lg leading-tight text-white placeholder:[color:var(--ph)]"
                        style={{
                          textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          "--ph": whiteReadable ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
                        } as React.CSSProperties}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="targetAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target</FormLabel>
              <FormControl>
                <AmountInput value={field.value} onChange={field.onChange} symbol={symbol} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currentAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved so far</FormLabel>
              <FormControl>
                <AmountInput value={field.value} onChange={field.onChange} symbol={symbol} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <ColorSelect value={field.value} onChange={field.onChange} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Icon</FormLabel>
              <IconPicker value={field.value} onChange={field.onChange} color={color} iconKeys={GOAL_ICON_KEYS} />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full bg-black text-white hover:bg-black/85 border-0 rounded-2xl font-bold">
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

function HabitForm({
  form, onSubmit, isPending, submitLabel,
}: {
  form: ReturnType<typeof useForm<HabitFormValues>>;
  onSubmit: (data: HabitFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const color = form.watch("color");
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {/* Nombre escrito directo sobre el color elegido — misma línea que Bill/Goal */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: color }}>
          <div className="absolute -top-6 -right-4 w-16 h-16 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.28)" }} />
          <div className="relative px-3.5 py-3.5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => {
                const whiteReadable = categoryTextColor("#ffffff", color).toLowerCase() === "#ffffff";
                return (
                  <FormItem>
                    <FormControl>
                      <input
                        aria-label="Habit name"
                        placeholder="e.g. No delivery"
                        autoComplete="off"
                        className="w-full bg-transparent border-0 outline-none font-title text-lg leading-tight text-white placeholder:[color:var(--ph)]"
                        style={{
                          textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          "--ph": whiteReadable ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
                        } as React.CSSProperties}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <ColorSelect value={field.value} onChange={field.onChange} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Icon</FormLabel>
              <IconPicker value={field.value} onChange={field.onChange} color={color} iconKeys={HABIT_ICON_KEYS} />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full bg-black text-white hover:bg-black/85 border-0 rounded-2xl font-bold">
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

function BillForm({
  form, onSubmit, isPending, submitLabel, symbol, expenseCategories, incomeCategories,
}: {
  form: ReturnType<typeof useForm<BillFormValues>>;
  onSubmit: (data: BillFormValues) => void;
  isPending: boolean;
  submitLabel: string;
  symbol: string;
  expenseCategories: { id: number; name: string }[];
  incomeCategories: { id: number; name: string }[];
}) {
  const color = form.watch("color");
  const type = form.watch("type");
  const day = form.watch("day");
  const autoSave = form.watch("autoSave");
  const categoryId = form.watch("categoryId");
  const isIncome = type === "income";
  const categories = isIncome ? incomeCategories : expenseCategories;
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Swipe horizontal sobre el número del stepper de día — mismo mecanismo de
  // pointer events que el swipe-to-delete de Transactions, pero acumulando
  // distancia en vez de trasladar la fila: cada DAY_DRAG_STEP_PX de arrastre
  // suma/resta un día, cíclico. El valor final se calcula en una variable local
  // (no leyendo field.value entre iteraciones) porque React batchea los setState
  // dentro del mismo evento — si el loop llamara field.onChange varias veces
  // seguidas, cada llamada seguiría viendo el valor viejo hasta el próximo render.
  const DAY_DRAG_STEP_PX = 24;
  // value vive en el ref (no solo derivado de field.value en cada render)
  // porque si varios pointermove disparan antes de que React confirme el
  // render del field.onChange anterior — normal en un swipe fluido — cada
  // evento arrancaría desde un valor desactualizado y se pisarían los pasos
  // entre sí, perdiendo la mayoría del recorrido. "down" (a diferencia de
  // "active", que marca si ya se cruzó el umbral de 6px) distingue "hay un
  // gesto en curso" de "no hay nada" — sin esto un pointermove sin pointerdown
  // previo (hover con mouse/trackpad, o cualquier evento suelto) procesaría
  // con el x/value default en vez de ser ignorado.
  const dayDrag = useRef({ x: 0, accum: 0, active: false, value: 1, down: false });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {/* Nombre escrito directo sobre el color elegido — no input genérico.
            El texto ya escrito siempre es blanco (a propósito), pero el placeholder
            en blanco tenue se vuelve ilegible contra colores claros como Flow Green —
            ahí, y solo ahí, el hint pasa a un tinte oscuro. */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: color }}>
          <div className="absolute -top-6 -right-4 w-16 h-16 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.28)" }} />
          <div className="relative px-3.5 pt-3 pb-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => {
                const whiteReadable = categoryTextColor("#ffffff", color).toLowerCase() === "#ffffff";
                return (
                  <FormItem>
                    <FormControl>
                      <input
                        aria-label="Flow name"
                        placeholder="e.g. Insurance"
                        autoComplete="off"
                        className="w-full bg-transparent border-0 outline-none font-title text-lg leading-tight text-white placeholder:[color:var(--ph)]"
                        style={{
                          textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          "--ph": whiteReadable ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
                        } as React.CSSProperties}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
            />
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/85 mt-0.5" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
              {selectedCategory ? selectedCategory.name : "Pick a category below"}
            </p>
          </div>
        </div>

        {/* Type — mismo toggle segmentado que usa la creación de categorías */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</FormLabel>
              <div
                className="relative flex items-center p-1 rounded-full w-full"
                style={{
                  backdropFilter: "blur(24px) saturate(1.6)",
                  WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.08))",
                  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="absolute top-1 left-1 rounded-full transition-transform duration-300 ease-out"
                  style={{
                    bottom: "4px",
                    width: "calc(50% - 4px)",
                    transform: isIncome ? "translateX(100%)" : "translateX(0%)",
                    background: isIncome
                      ? "linear-gradient(135deg, rgba(29,185,84,0.95), rgba(29,185,84,0.75))"
                      : "linear-gradient(135deg, rgba(255,59,59,0.95), rgba(255,59,59,0.75))",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.18)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    field.onChange("expense");
                    form.setValue("color", "#FF4D4D");
                    if (!expenseCategories.some((c) => c.id === form.getValues("categoryId"))) form.setValue("categoryId", undefined);
                  }}
                  className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors duration-300 rounded-full", !isIncome ? "text-white" : "text-foreground/50")}
                >
                  <TrendingDown className="h-4 w-4" />
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    field.onChange("income");
                    form.setValue("color", "#00FF9C");
                    if (!incomeCategories.some((c) => c.id === form.getValues("categoryId"))) form.setValue("categoryId", undefined);
                  }}
                  className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors duration-300 rounded-full", isIncome ? "text-white" : "text-foreground/50")}
                >
                  <TrendingUp className="h-4 w-4" />
                  Income
                </button>
              </div>
            </FormItem>
          )}
        />

        {/* Monto — display grande centrado, siempre con decimales (no todos los pagos son redondos) */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <AmountInput value={field.value} onChange={field.onChange} symbol={symbol} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Día del mes — stepper compacto (antes era una grilla de 31 casilleros que
            ocupaba casi un tercio del modal), el mes se autodetecta. Cíclico: pasado
            el 31 vuelve al 1 y viceversa, así nunca queda "trabado" en una punta. */}
        <FormField
          control={form.control}
          name="day"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Repeats monthly on</FormLabel>
              <div className="flex items-center justify-center gap-6 py-1">
                <button
                  type="button"
                  onClick={() => field.onChange(field.value <= 1 ? 31 : field.value - 1)}
                  className="w-9 h-9 shrink-0 rounded-full bg-muted text-foreground text-base font-bold flex items-center justify-center active:scale-90 transition-transform"
                >
                  ‹
                </button>
                <div
                  // Antes min-w-[3.5rem] (~56px) — la mitad del área táctil que tiene
                  // el stepper de color (~112px). Un toque suave tiene mucho menos
                  // margen de error para arrancar el gesto en 56px, así que aunque la
                  // lógica del drag sea idéntica, ahí es donde se perdían los toques.
                  className="text-center leading-none min-w-[7rem] py-1.5 select-none touch-none"
                  onPointerDown={(e) => {
                    dayDrag.current = { x: e.clientX, accum: 0, active: false, value: field.value, down: true };
                    // Sin esto, un swipe rápido se escapa del elemento (es angosto,
                    // ~3.5rem) y el navegador deja de mandarle pointermove/pointerup —
                    // el próximo intento quedaba con "active" trabado en true. Mismo
                    // fix que ya usa el swipe de Transactions y el numpad.
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const st = dayDrag.current;
                    if (!st.down) return;
                    const dx = e.clientX - st.x;
                    if (!st.active) {
                      if (Math.abs(dx) < 6) return;
                      st.active = true;
                    }
                    // Defensivo: touch-none ya debería bastar, pero por si algún
                    // WebView de Android no lo respeta del todo dentro de un modal
                    // scrolleable, esto evita que el scroll nativo compita con el
                    // drag — mismo patrón que usa el swipe de Transactions.
                    e.preventDefault();
                    st.accum += dx;
                    st.x = e.clientX;
                    let value = st.value;
                    while (st.accum >= DAY_DRAG_STEP_PX) { value = value >= 31 ? 1 : value + 1; st.accum -= DAY_DRAG_STEP_PX; }
                    while (st.accum <= -DAY_DRAG_STEP_PX) { value = value <= 1 ? 31 : value - 1; st.accum += DAY_DRAG_STEP_PX; }
                    // Un solo haptic por evento (no uno por paso del while) — mismo
                    // criterio que el color stepper de categorías, para que se sientan iguales.
                    if (value !== st.value) { st.value = value; field.onChange(value); triggerHaptic(); }
                  }}
                  onPointerUp={(e) => {
                    dayDrag.current.active = false;
                    dayDrag.current.down = false;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={(e) => {
                    dayDrag.current.active = false;
                    dayDrag.current.down = false;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                >
                  <span className="font-entry-amount text-4xl leading-none">{field.value}</span>
                  <span className="text-sm font-bold text-muted-foreground align-super ml-0.5">{ordinalSuffix(field.value)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => field.onChange(field.value >= 31 ? 1 : field.value + 1)}
                  className="w-9 h-9 shrink-0 rounded-full bg-muted text-foreground text-base font-bold flex items-center justify-center active:scale-90 transition-transform"
                >
                  ›
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Every month on the <span className="font-bold text-foreground">{ordinal(day)}</span> — next: <span className="font-bold text-foreground">{nextDayOccurrence(day)}</span>
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Categoría — pills simples, sin color (acá no aporta), filtradas por type */}
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</FormLabel>
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {categories.map((c) => {
                  const isSelected = field.value === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => field.onChange(c.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors",
                        isSelected ? "bg-foreground text-background" : "bg-muted text-foreground"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Auto-save — fila chica, siempre Flow Green */}
        <FormField
          control={form.control}
          name="autoSave"
          render={({ field }) => (
            <FormItem>
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className="w-full flex items-center justify-between py-1"
              >
                <span className="text-sm font-bold text-left">Auto-save to Transactions</span>
                <span
                  className="relative w-10 h-6 rounded-full shrink-0 transition-colors"
                  style={{ background: field.value ? "#CAFA01" : "hsl(var(--border))" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: field.value ? "translateX(16px)" : "translateX(0)" }}
                  />
                </span>
              </button>
            </FormItem>
          )}
        />
        {autoSave && !categoryId && (
          <p className="text-[11px] text-amber-600 -mt-1">Pick a category above so auto-save knows where to file it.</p>
        )}

        {/* Color — dropdown básico, como Goal/Habit — sin tocar, mismos 10 colores de siempre */}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <ColorSelect value={field.value} onChange={field.onChange} />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-black text-white hover:bg-black/85 border-0 rounded-2xl font-bold"
        >
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}

/* ------------------------------------------------------------------ */
/* Heatmap                                                             */
/* ------------------------------------------------------------------ */

function Heatmap({
  weeks, logged, color, cellRadius = 2, compact = false,
}: {
  weeks: string[][]; logged: Set<string>; color: string; cellRadius?: number; compact?: boolean;
}) {
  const today = todayKey();
  return (
    <div
      className="w-full"
      style={{
        display: "grid",
        // Filas de altura fija — compact usa celdas de 9px: bajito pero con presencia
        gridTemplateRows: compact ? "repeat(7, 9px)" : "repeat(7, 1fr)",
        gridAutoFlow: "column",
        gridAutoColumns: "1fr",
        gap: "2px",
      }}
    >
      {weeks.map((week, wi) =>
        week.map((day, di) => {
          const isFuture = day > today;
          const isDone = logged.has(day);
          return (
            <div
              key={`${wi}-${di}`}
              className={compact ? undefined : "aspect-square"}
              style={{
                gridColumn: wi + 1,
                gridRow: di + 1,
                borderRadius: `${cellRadius}px`,
                backgroundColor: isFuture ? "transparent" : isDone ? color : `${color}26`,
              }}
            />
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heatmap mensual (Bills) — mismo lenguaje que Heatmap, grano de mes  */
/* en vez de día: 12 celdas fijas, no semanas/columnas.                */
/* ------------------------------------------------------------------ */

/** Preview NO interactivo — mismo rol que el <Heatmap compact /> de Habits en la lista.
 * La edición real vive en BillDetail (grid mensual con nav de año), evitando además
 * anidar un <button> clickeable dentro del <button> que abre el detalle. */
function MonthHeatmap({ months, logged, color }: { months: string[]; logged: Set<string>; color: string }) {
  const current = currentMonthKey();
  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-12 gap-1">
        {months.map((m) => {
          const isFuture = m > current;
          const isDone = logged.has(m);
          const isCurrent = m === current;
          return (
            <div
              key={m}
              className="aspect-square rounded"
              style={{
                backgroundColor: isFuture ? "transparent" : isDone ? color : `${color}26`,
                boxShadow: isCurrent ? `0 0 0 1.5px ${color}` : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-12 gap-1">
        {months.map((m) => {
          const isCurrent = m === current;
          const letter = MONTHS[Number(m.split("-")[1]) - 1][0];
          return (
            <p
              key={m}
              className="text-center text-[8px] leading-none font-semibold"
              style={{ color: isCurrent ? color : "hsl(var(--muted-foreground))" }}
            >
              {letter}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detalle de hábito                                                   */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HabitDetail({
  habit, onClose, onToggleDay, onEdit, onDelete,
}: {
  habit: Habit;
  onClose: () => void;
  onToggleDay: (date: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const color = habit.color ?? "#CAFA01";
  const logged = useMemo(() => new Set(habit.logs), [habit.logs]);
  const weeks = useMemo(() => buildWeeks(26), []);
  const today = todayKey();

  const monthDays = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const cells: { key: string; day: number; inMonth: boolean }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i++) {
      cells.push({ key: toKey(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === month.m });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [month]);

  const prevMonth = () => setMonth((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }));
  const nextMonth = () => setMonth((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }));

  return (
    <FloatingModal open onClose={onClose} title="">
      <div className="-mt-8 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
            <HabitIcon icon={habit.icon} className="h-4 w-4" style={{ color }} />
          </div>
          <p className="font-bold text-base leading-tight uppercase tracking-wide truncate">{habit.name}</p>
        </div>

        <Heatmap weeks={weeks} logged={logged} color={color} cellRadius={2} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
            <Flame className="h-3.5 w-3.5" style={{ color }} />
            <span className="text-sm font-bold">{habit.streak}</span>
            <span className="text-[11px] text-muted-foreground">streak</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="relative h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all before:absolute before:-inset-1.5 before:content-['']">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <ConfirmDialog
              trigger={
                <button className="relative h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-all before:absolute before:-inset-1.5 before:content-['']">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              }
              icon={Trash2}
              title="Delete Habit"
              description={`Delete "${habit.name}" and all its history? This cannot be undone.`}
              confirmLabel="Delete"
              onConfirm={onDelete}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW.map((d) => (
              <p key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((cell) => {
              const isFuture = cell.key > today;
              const isDone = logged.has(cell.key);
              const isToday = cell.key === today;
              return (
                <button
                  key={cell.key}
                  disabled={isFuture}
                  onClick={() => onToggleDay(cell.key)}
                  className={cn(
                    "aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-all active:scale-90",
                    !cell.inMonth && "opacity-30",
                    isFuture && "opacity-20"
                  )}
                  style={{
                    backgroundColor: isDone ? color : "hsl(var(--muted) / 0.5)",
                    color: isDone ? "#000" : undefined,
                    boxShadow: isToday ? `0 0 0 2px ${color}` : undefined,
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-sm font-bold">{MONTHS[month.m]} {month.y}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={prevMonth} className="relative h-7 w-7 flex items-center justify-center rounded-xl bg-muted before:absolute before:-inset-2 before:content-['']">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} className="relative h-7 w-7 flex items-center justify-center rounded-xl bg-muted before:absolute before:-inset-2 before:content-['']">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </FloatingModal>
  );
}

/** Confirmación de borrar bill — variante especial del ConfirmDialog genérico:
 * si el bill tiene transacciones reales vinculadas (auto-save), ofrece un
 * checkbox para borrarlas también. Sin eso, el borrado del bill nunca toca
 * las transacciones — son un movimiento de plata real, no algo que desaparece
 * solo porque se borró el tracker recurrente. */
function DeleteBillDialog({
  trigger, bill, onConfirm,
}: {
  trigger: React.ReactNode;
  bill: Bill;
  onConfirm: (deleteTransactions: boolean) => void;
}) {
  const [deleteTx, setDeleteTx] = useState(false);
  const hasLinked = bill.linkedTransactionCount > 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-xs rounded-3xl border-0 p-6 gap-0">
        <div className="flex flex-col items-center text-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
            <Trash2 className="h-5 w-5" style={{ color: "hsl(var(--destructive))" }} />
          </div>
          <AlertDialogHeader className="items-center text-center space-y-1.5">
            <AlertDialogTitle className="text-base font-bold">Delete Bill</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center leading-relaxed">
              Delete "{bill.name}" and all its history? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        {hasLinked && (
          <button
            type="button"
            onClick={() => setDeleteTx((v) => !v)}
            className="w-full flex items-center gap-2.5 rounded-2xl bg-muted px-3.5 py-3 mt-1 mb-1 text-left"
          >
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors"
              style={{
                backgroundColor: deleteTx ? "hsl(var(--destructive))" : "transparent",
                boxShadow: deleteTx ? "none" : "inset 0 0 0 1.5px hsl(var(--border))",
              }}
            >
              {deleteTx && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-xs font-semibold leading-tight">
              Also delete {bill.linkedTransactionCount} linked transaction{bill.linkedTransactionCount === 1 ? "" : "s"}
            </span>
          </button>
        )}

        <AlertDialogFooter className="flex-col-reverse gap-2 pt-2 sm:flex-col-reverse">
          <AlertDialogCancel className="w-full rounded-2xl border-0 bg-muted font-semibold hover:bg-muted/80">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(deleteTx)}
            className="w-full rounded-2xl font-bold border-0 bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Detalle de bill — mismo lenguaje que HabitDetail, grano mensual:    */
/* grid de 12 meses (3x4) con nav de AÑO en vez de calendario diario   */
/* con nav de mes.                                                     */
/* ------------------------------------------------------------------ */

function BillDetail({
  bill, onClose, onToggleMonth, onEdit, onDelete, category, symbol,
}: {
  bill: Bill;
  onClose: () => void;
  onToggleMonth: (month: string) => void;
  onEdit: () => void;
  onDelete: (deleteTransactions: boolean) => void;
  category: { name: string } | undefined;
  symbol: string;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const color = bill.color ?? "#CAFA01";
  const logged = useMemo(() => new Set(bill.logs), [bill.logs]);
  const months = useMemo(() => monthsOfYear(year), [year]);
  const overviewMonths = useMemo(() => monthsOfYear(new Date().getFullYear()), []);
  const current = currentMonthKey();
  const paidThisYear = bill.logs.filter((m) => m.startsWith(String(year))).length;

  const prevYear = () => setYear((y) => y - 1);
  const nextYear = () => setYear((y) => y + 1);

  return (
    <FloatingModal open onClose={onClose} title="">
      <div className="-mt-8 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
            <span className="text-sm font-black leading-none" style={{ color }}>{bill.day}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight uppercase tracking-wide truncate">{bill.name}</p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              {bill.amount ? `${symbol} ${fmtMoney(bill.amount)}` : category?.name ?? "No category"}
              {bill.autoSave && " · Auto-save"}
            </p>
          </div>
        </div>

        <MonthHeatmap months={overviewMonths} logged={logged} color={color} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted">
            <span className="text-sm font-bold">{paidThisYear}</span>
            <span className="text-[11px] text-muted-foreground">/12 paid in {year}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="relative h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all before:absolute before:-inset-1.5 before:content-['']">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <DeleteBillDialog
              trigger={
                <button className="relative h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-all before:absolute before:-inset-1.5 before:content-['']">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              }
              bill={bill}
              onConfirm={onDelete}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        <div>
          <div className="grid grid-cols-3 gap-2">
            {months.map((m, i) => {
              const isFuture = m > current;
              const isDone = logged.has(m);
              const isCurrent = m === current;
              return (
                <button
                  key={m}
                  disabled={isFuture}
                  onClick={() => onToggleMonth(m)}
                  className={cn(
                    "rounded-lg py-3 text-xs font-bold transition-all active:scale-90",
                    isFuture && "opacity-30"
                  )}
                  style={{
                    backgroundColor: isDone ? color : "hsl(var(--muted) / 0.5)",
                    color: isDone ? "#000" : undefined,
                    boxShadow: isCurrent ? `0 0 0 2px ${color}` : undefined,
                  }}
                >
                  {MONTHS[i]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-sm font-bold">{year}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={prevYear} className="relative h-7 w-7 flex items-center justify-center rounded-xl bg-muted before:absolute before:-inset-2 before:content-['']">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextYear} className="relative h-7 w-7 flex items-center justify-center rounded-xl bg-muted before:absolute before:-inset-2 before:content-['']">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </FloatingModal>
  );
}

/* ------------------------------------------------------------------ */
/* Detalle de goal — mismo lenguaje que HabitDetail/BillDetail: header,   */
/* "preview" (acá la barra de progreso en vez de heatmap/calendario),     */
/* resumen + edit/delete. No hay grid interactivo porque no aplica.       */
/* ------------------------------------------------------------------ */

function GoalDetail({
  goal, onClose, onAddMoney, onEdit, onDelete, symbol,
}: {
  goal: Goal;
  onClose: () => void;
  onAddMoney: () => void;
  onEdit: () => void;
  onDelete: () => void;
  symbol: string;
}) {
  const color = goal.color ?? "#CAFA01";
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <FloatingModal open onClose={onClose} title="">
      <div className="-mt-8 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
            <HabitIcon icon={goal.icon} className="h-4 w-4" style={{ color }} />
          </div>
          <p className="font-bold text-base leading-tight uppercase tracking-wide truncate">{goal.name}</p>
        </div>

        {/* Reencuadre: lo que falta, no lo que ya se ve en la lista */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Still needed</p>
          <p className="font-number text-3xl leading-tight" style={{ color }}>{symbol} {fmtMoney(remaining)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {symbol} {fmtMoney(goal.currentAmount)} saved of {symbol} {fmtMoney(goal.targetAmount)} · {Math.round(pct)}%
          </p>
          <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: `${color}22` }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>

        <Button onClick={onAddMoney} className="w-full bg-black text-white hover:bg-black/85 border-0 rounded-2xl font-bold">
          <Plus className="h-4 w-4" strokeWidth={3} />
          Add money
        </Button>

        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-muted text-sm font-semibold text-muted-foreground hover:text-foreground transition-all">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <ConfirmDialog
            trigger={
              <button className="flex-1 h-10 w-full flex items-center justify-center gap-1.5 rounded-xl bg-muted text-sm font-semibold text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            }
            icon={Trash2}
            title="Delete Goal"
            description={`Delete "${goal.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={onDelete}
          />
        </div>
      </div>
    </FloatingModal>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Goals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [goalModal, setGoalModal] = useState<"create" | number | null>(null);
  const [habitModal, setHabitModal] = useState<"create" | number | null>(null);
  const [billModal, setBillModal] = useState<"create" | number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [billDetailId, setBillDetailId] = useState<number | null>(null);
  const [goalDetailId, setGoalDetailId] = useState<number | null>(null);
  const [addMoneyGoal, setAddMoneyGoal] = useState<Goal | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"savings" | "habits" | "bills">(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "savings" || t === "habits" ? t : "bills";
  });
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [payMonth, setPayMonth] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");

  // Símbolo de la moneda elegida en settings (Q, $, €, ...)
  const { currency } = useCurrency();
  const symbol = ((CURRENCY_INFO as Record<string, any>)[currency]?.symbol as string | undefined) ?? currency;

  const goalsQuery = useQuery(goalsQueryOptions);
  const habitsQuery = useQuery(habitsQueryOptions);
  const billsQuery = useQuery(billsQueryOptions);
  const { data: rawCategories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const expenseCategories = useMemo(
    () => (rawCategories ?? []).filter((c: any) => c.type === "expense" || c.type === "both"),
    [rawCategories]
  );
  const incomeCategories = useMemo(
    () => (rawCategories ?? []).filter((c: any) => c.type === "income" || c.type === "both"),
    [rawCategories]
  );
  // Aportes a metas de ahorro comparten UNA categoría fija — no son un gasto
  // discrecional como "Comida" o "Transporte", son plata que se mueve a savings.
  // La descripción de cada transacción ("Added to {goal}") sigue diferenciando
  // a qué meta fue cada aporte aunque compartan categoría.
  const savingsCategory = useMemo(
    () => (rawCategories ?? []).find((c: any) => c.name === "Savings" && (c.type === "expense" || c.type === "both")),
    [rawCategories]
  );

  const invalidateGoals = () => queryClient.invalidateQueries({ queryKey: ["goals"] });
  const invalidateHabits = () => queryClient.invalidateQueries({ queryKey: ["habits"] });
  const invalidateBills = () => queryClient.invalidateQueries({ queryKey: ["bills"] });
  const invalidateTransactions = () => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
    // Un Flow pagado (manual o auto-save) crea una transacción real — sin esto,
    // Insights se quedaba con la data vieja de Fixed vs flexible/Category on
    // the move hasta cerrar y reabrir la app.
    queryClient.invalidateQueries({ queryKey: ["insights-anomaly"] });
    queryClient.invalidateQueries({ queryKey: ["insights-fixed-vs-flexible"] });
    queryClient.invalidateQueries({ queryKey: ["insights-income-summary"] });
  };

  /* ---------- mutations: goals ---------- */

  // Montos como string: los acepta cualquier versión del backend
  const goalPayload = (data: GoalFormValues) =>
    JSON.stringify({ ...data, targetAmount: String(data.targetAmount), currentAmount: String(data.currentAmount) });

  const createGoal = useMutation({
    mutationFn: (data: GoalFormValues) => api("/goals", { method: "POST", body: goalPayload(data) }),
    // ⚡ Optimista: el modal se cierra ya y la card aparece de inmediato
    onMutate: async (data) => {
      setGoalModal(null);
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const prev = queryClient.getQueryData<Goal[]>(["goals"]);
      const temp: Goal = {
        id: -Date.now(),
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount,
        icon: data.icon,
        color: data.color,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Goal[]>(["goals"], (old) => [temp, ...(old ?? [])]);
      return { prev };
    },
    onError: (e, _d, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["goals"], ctx.prev);
      toast({ title: "Failed to create goal", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateGoals(),
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GoalFormValues }) =>
      api(`/goals/${id}`, { method: "PATCH", body: goalPayload(data) }),
    // ⚡ Optimista: cambios visibles al instante
    onMutate: async ({ id, data }) => {
      setGoalModal(null);
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const prev = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) =>
        (old ?? []).map((g) => (g.id === id ? { ...g, ...data } : g))
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["goals"], ctx.prev);
      toast({ title: "Failed to update goal", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateGoals(),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: number) => api(`/goals/${id}`, { method: "DELETE" }),
    // Optimista: desaparece de inmediato
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const prev = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) => (old ?? []).filter((g) => g.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["goals"], ctx.prev);
      toast({ title: "Failed to delete goal", variant: "destructive" });
    },
    onSettled: () => invalidateGoals(),
  });

  // 💰 Agregar dinero a una meta — registra el aporte en el backend (que suma a
  // currentAmount de forma atómica) y lo linkea a la transacción real que ya se
  // creó antes de llamar esto (ver handleAddMoneySubmit). Optimista sobre el total.
  const addContribution = useMutation({
    mutationFn: ({ id, amount, transactionId }: { id: number; amount: number; transactionId?: number }) =>
      api(`/goals/${id}/contributions`, { method: "POST", body: JSON.stringify({ amount, transactionId }) }),
    onMutate: async ({ id, amount }) => {
      setAddMoneyGoal(null);
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const prev = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) =>
        (old ?? []).map((g) => (g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g))
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["goals"], ctx.prev);
      toast({ title: "Failed to add money", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateGoals(),
  });

  /* ---------- mutations: habits ---------- */

  const createHabit = useMutation({
    mutationFn: (data: HabitFormValues) => api("/habits", { method: "POST", body: JSON.stringify(data) }),
    // ⚡ Optimista: el modal se cierra ya y la card aparece de inmediato
    onMutate: async (data) => {
      setHabitModal(null);
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const prev = queryClient.getQueryData<Habit[]>(["habits"]);
      const temp: Habit = {
        id: -Date.now(),
        name: data.name,
        icon: data.icon,
        color: data.color,
        createdAt: new Date().toISOString(),
        logs: [],
        streak: 0,
      };
      queryClient.setQueryData<Habit[]>(["habits"], (old) => [temp, ...(old ?? [])]);
      return { prev };
    },
    onError: (e, _d, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["habits"], ctx.prev);
      toast({ title: "Failed to create habit", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateHabits(),
  });

  const updateHabit = useMutation({
    mutationFn: ({ id, data }: { id: number; data: HabitFormValues }) =>
      api(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    // ⚡ Optimista
    onMutate: async ({ id, data }) => {
      setHabitModal(null);
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const prev = queryClient.getQueryData<Habit[]>(["habits"]);
      queryClient.setQueryData<Habit[]>(["habits"], (old) =>
        (old ?? []).map((h) => (h.id === id ? { ...h, ...data } : h))
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["habits"], ctx.prev);
      toast({ title: "Failed to update habit", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateHabits(),
  });

  const deleteHabit = useMutation({
    mutationFn: (id: number) => api(`/habits/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const prev = queryClient.getQueryData<Habit[]>(["habits"]);
      queryClient.setQueryData<Habit[]>(["habits"], (old) => (old ?? []).filter((h) => h.id !== id));
      setDetailId(null);
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["habits"], ctx.prev);
      toast({ title: "Failed to delete habit", variant: "destructive" });
    },
    onSettled: () => invalidateHabits(),
  });

  // ⚡ Toggle OPTIMISTA: el cuadrito se marca al instante, el server sincroniza atrás
  const toggleLog = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/habits/${id}/logs/${date}`, { method: "PUT" }),
    onMutate: async ({ id, date }) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const prev = queryClient.getQueryData<Habit[]>(["habits"]);
      queryClient.setQueryData<Habit[]>(["habits"], (old) =>
        (old ?? []).map((h) => {
          if (h.id !== id) return h;
          const set = new Set(h.logs);
          if (set.has(date)) set.delete(date);
          else set.add(date);
          return { ...h, logs: Array.from(set), streak: clientStreak(set) };
        })
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["habits"], ctx.prev);
      toast({ title: "Failed to update day", variant: "destructive" });
    },
    onSettled: () => invalidateHabits(),
  });

  /* ---------- mutations: bills ---------- */

  const billPayload = (data: BillFormValues) => JSON.stringify({
    ...data,
    amount: data.amount != null ? String(data.amount) : undefined,
  });

  const createBill = useMutation({
    mutationFn: (data: BillFormValues) => api("/bills", { method: "POST", body: billPayload(data) }),
    onMutate: async (data) => {
      setBillModal(null);
      await queryClient.cancelQueries({ queryKey: ["bills"] });
      const prev = queryClient.getQueryData<Bill[]>(["bills"]);
      const temp: Bill = {
        id: -Date.now(),
        name: data.name,
        icon: data.icon,
        color: data.color,
        type: data.type,
        day: data.day,
        amount: data.amount ?? null,
        categoryId: data.categoryId ?? null,
        autoSave: data.autoSave ?? false,
        createdAt: new Date().toISOString(),
        logs: [],
        paidThisMonth: false,
        linkedTransactionCount: 0,
      };
      queryClient.setQueryData<Bill[]>(["bills"], (old) => [temp, ...(old ?? [])]);
      return { prev };
    },
    onError: (e, _d, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["bills"], ctx.prev);
      toast({ title: "Failed to create bill", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateBills(),
  });

  const updateBill = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BillFormValues }) =>
      api(`/bills/${id}`, { method: "PATCH", body: billPayload(data) }),
    onMutate: async ({ id, data }) => {
      setBillModal(null);
      await queryClient.cancelQueries({ queryKey: ["bills"] });
      const prev = queryClient.getQueryData<Bill[]>(["bills"]);
      queryClient.setQueryData<Bill[]>(["bills"], (old) =>
        (old ?? []).map((b) => (b.id === id ? { ...b, ...data, amount: data.amount ?? null, categoryId: data.categoryId ?? null, autoSave: data.autoSave ?? false } : b))
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["bills"], ctx.prev);
      toast({ title: "Failed to update bill", description: String(e), variant: "destructive" });
    },
    onSettled: () => invalidateBills(),
  });

  const deleteBill = useMutation({
    mutationFn: ({ id, deleteTransactions }: { id: number; deleteTransactions: boolean }) =>
      api(`/bills/${id}${deleteTransactions ? "?deleteTransactions=true" : ""}`, { method: "DELETE" }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["bills"] });
      const prev = queryClient.getQueryData<Bill[]>(["bills"]);
      queryClient.setQueryData<Bill[]>(["bills"], (old) => (old ?? []).filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["bills"], ctx.prev);
      toast({ title: "Failed to delete bill", variant: "destructive" });
    },
    onSuccess: (_data, { deleteTransactions }) => {
      if (deleteTransactions) invalidateTransactions();
    },
    onSettled: () => invalidateBills(),
  });

  // ⚡ Toggle optimista del mes actual — igual patrón que toggleLog de habits
  const toggleBillLog = useMutation({
    mutationFn: ({ id, month, amountPaid, transactionId }: { id: number; month: string; amountPaid?: number; transactionId?: number }) =>
      api(`/bills/${id}/logs/${month}`, {
        method: "PUT",
        body: JSON.stringify({ amountPaid, transactionId }),
      }),
    onMutate: async ({ id, month }) => {
      await queryClient.cancelQueries({ queryKey: ["bills"] });
      const prev = queryClient.getQueryData<Bill[]>(["bills"]);
      queryClient.setQueryData<Bill[]>(["bills"], (old) =>
        (old ?? []).map((b) => {
          if (b.id !== id) return b;
          const set = new Set(b.logs);
          if (set.has(month)) set.delete(month);
          else set.add(month);
          return { ...b, logs: Array.from(set), paidThisMonth: set.has(currentMonthKey()) };
        })
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["bills"], ctx.prev);
      toast({ title: "Failed to update bill", variant: "destructive" });
    },
    onSettled: () => invalidateBills(),
  });

  const createTransaction = useCreateTransaction();
  const createCategory = useCreateCategory();

  /* ---------- forms ---------- */

  const goalForm = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: { name: "", targetAmount: 0, currentAmount: 0, icon: "piggybank", color: "#CAFA01" },
  });

  const habitForm = useForm<HabitFormValues>({
    resolver: zodResolver(habitSchema),
    defaultValues: { name: "", icon: "ban", color: "#CAFA01" },
  });

  const openCreateGoal = () => {
    goalForm.reset({ name: "", targetAmount: 0, currentAmount: 0, icon: "piggybank", color: "#CAFA01" });
    setGoalModal("create");
  };

  const openEditGoal = (g: Goal) => {
    goalForm.reset({
      name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
      icon: g.icon ?? "piggybank", color: g.color ?? "#CAFA01",
    });
    setGoalModal(g.id);
  };

  const openCreateHabit = () => {
    habitForm.reset({ name: "", icon: "ban", color: "#CAFA01" });
    setHabitModal("create");
  };

  const openEditHabit = (h: Habit) => {
    habitForm.reset({ name: h.name, icon: h.icon ?? "ban", color: h.color ?? "#CAFA01" });
    setHabitModal(h.id);
  };

  const onGoalSubmit = (data: GoalFormValues) => {
    if (goalModal === "create") createGoal.mutate(data);
    else if (typeof goalModal === "number") updateGoal.mutate({ id: goalModal, data });
  };

  const onHabitSubmit = (data: HabitFormValues) => {
    if (habitModal === "create") createHabit.mutate(data);
    else if (typeof habitModal === "number") updateHabit.mutate({ id: habitModal, data });
  };

  const billForm = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: { name: "", icon: "creditcard", color: "#FF4D4D", type: "expense", day: 1, amount: undefined, categoryId: undefined, autoSave: false },
  });

  const openCreateBill = () => {
    billForm.reset({ name: "", icon: "creditcard", color: "#FF4D4D", type: "expense", day: 1, amount: undefined, categoryId: undefined, autoSave: false });
    setBillModal("create");
  };

  const openEditBill = (b: Bill) => {
    billForm.reset({
      name: b.name, icon: b.icon ?? "creditcard", color: b.color ?? "#CAFA01",
      type: b.type, day: b.day,
      amount: b.amount ?? undefined, categoryId: b.categoryId ?? undefined, autoSave: b.autoSave,
    });
    setBillModal(b.id);
  };

  const onBillSubmit = (data: BillFormValues) => {
    if (billModal === "create") createBill.mutate(data);
    else if (typeof billModal === "number") updateBill.mutate({ id: billModal, data });
  };

  // Al desmarcar no hace falta preguntar nada — solo se borra el "pagado" de ese mes.
  // Al marcar (cualquier mes del heatmap, no solo el actual): si el bill tiene auto-save,
  // se pide el monto real y se crea la transacción antes de loguear el mes como pagado
  // (para poder linkear transactionId). Sin auto-save, solo se loguea el mes.
  const handleToggleBillMonth = (b: Bill, month: string) => {
    if (b.id < 0) return;
    const isPaid = new Set(b.logs).has(month);
    if (isPaid) {
      toggleBillLog.mutate({ id: b.id, month });
      return;
    }
    if (b.autoSave && b.categoryId) {
      setBillDetailId(null);
      setPayBill(b);
      setPayMonth(month);
      setPayAmount(b.amount ? formatAmountInput(String(b.amount)) : "");
      return;
    }
    toggleBillLog.mutate({ id: b.id, month });
  };

  const handlePaySubmit = () => {
    if (!payBill || !payMonth) return;
    const numeric = parseAmountInput(payAmount);
    if (!numeric || numeric <= 0 || !payBill.categoryId) return;
    createTransaction.mutate(
      { data: { type: payBill.type, amount: numeric, description: payBill.name, categoryId: payBill.categoryId, date: billDateFor(payMonth, payBill.day) } },
      {
        onSuccess: (tx: any) => {
          invalidateTransactions();
          toggleBillLog.mutate({ id: payBill.id, month: payMonth, amountPaid: numeric, transactionId: tx?.id });
          setPayBill(null);
          setPayMonth(null);
          toast({ title: `${payBill.name} marked as paid` });
        },
        onError: () => toast({ title: "Failed to save transaction", variant: "destructive" }),
      }
    );
  };

  // Agregar plata a una meta: crea una transacción real primero (categoría "Savings"
  // compartida por todos los aportes, se crea sola la primera vez que hace falta) y
  // recién con el id de esa transacción registra el aporte — mismo orden que Bills
  // con auto-save, así currentAmount nunca queda desconectado de una transacción real.
  const handleAddMoneySubmit = async () => {
    if (!addMoneyGoal) return;
    const goal = addMoneyGoal;
    const amount = parseAmountInput(addAmount);
    if (!amount || amount <= 0) return;

    let categoryId = savingsCategory?.id;
    if (!categoryId) {
      try {
        const cat: any = await createCategory.mutateAsync({
          data: { name: "Savings", type: "expense", color: "#7CB518", icon: "piggybank" },
        });
        categoryId = cat?.id;
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      } catch {
        toast({ title: "Failed to add money", variant: "destructive" });
        return;
      }
    }
    if (!categoryId) return;

    createTransaction.mutate(
      { data: { type: "expense", amount, description: `Added to ${goal.name}`, categoryId, date: new Date().toISOString().slice(0, 10) } },
      {
        onSuccess: (tx: any) => {
          invalidateTransactions();
          addContribution.mutate({ id: goal.id, amount, transactionId: tx?.id });
          toast({ title: `Added ${symbol}${fmtMoney(amount)} to ${goal.name}` });
        },
        onError: () => toast({ title: "Failed to save transaction", variant: "destructive" }),
      }
    );
  };

  /* ---------- derived ---------- */

  const goals = goalsQuery.data ?? [];
  const habits = habitsQuery.data ?? [];
  const bills = billsQuery.data ?? [];
  const heatmapWeeks = useMemo(() => buildWeeks(30), []);
  const billMonths = useMemo(() => monthsOfYear(new Date().getFullYear()), []);
  const today = todayKey();
  const detailHabit = detailId !== null ? habits.find((h) => h.id === detailId) ?? null : null;
  const detailBill = billDetailId !== null ? bills.find((b) => b.id === billDetailId) ?? null : null;
  const detailGoal = goalDetailId !== null ? goals.find((g) => g.id === goalDetailId) ?? null : null;
  const isLoading = goalsQuery.isLoading || habitsQuery.isLoading || billsQuery.isLoading;

  const billsPaidThisMonth = bills.filter((b) => b.paidThisMonth).length;

  // Auto-save real: si el Flow tiene auto-save + monto cargado y el día elegido ya
  // llegó (o pasó) este mes sin marcarse, se marca solo — crea la transacción sin
  // pedir confirmación (por eso "Salario" con auto-save cae solo en Transactions
  // cada 15). No hay cron en el backend: esto corre cuando la app está abierta, así
  // que si no la abriste el día exacto, se pone al día la próxima vez que entrás.
  // Sin monto cargado no hay forma de saber cuánto cobrar, así que sigue abriendo
  // el sheet de pago manual como siempre.
  const autoFiredRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!billsQuery.data) return;
    const todayDate = new Date().getDate();
    for (const b of bills) {
      if (b.id < 0 || !b.autoSave || !b.categoryId || b.amount == null) continue;
      if (b.paidThisMonth || b.day > todayDate) continue;
      if (autoFiredRef.current.has(b.id)) continue;
      autoFiredRef.current.add(b.id);
      const month = currentMonthKey();
      const amount = b.amount;
      createTransaction.mutate(
        { data: { type: b.type, amount, description: b.name, categoryId: b.categoryId, date: billDateFor(month, b.day) } },
        {
          onSuccess: (tx: any) => {
            invalidateTransactions();
            toggleBillLog.mutate({ id: b.id, month, amountPaid: amount, transactionId: tx?.id });
            toast({ title: `${b.name} marked as paid`, description: `${symbol} ${fmtMoney(amount)} · auto-save` });
          },
          onError: () => { autoFiredRef.current.delete(b.id); },
        }
      );
    }
  }, [billsQuery.data]);

  /* ---------- render ---------- */

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h2 className="font-title text-3xl pr-14 min-h-10 flex items-center">Goals</h2>

      {/* Switcher — Flows / Savings / Habits, track plano + thumb verde (mismo lenguaje que RangeSwitch del dashboard) */}
      <div className="relative grid grid-cols-3 rounded-full bg-muted p-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-full transition-transform duration-300 ease-out"
          style={{
            width: "calc(33.333% - 0.1667rem)",
            transform:
              activeTab === "savings" ? "translateX(100%)" : activeTab === "habits" ? "translateX(200%)" : "translateX(0)",
            background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
          }}
        />
        {([
          { key: "bills", label: "Flows" },
          { key: "savings", label: "Savings" },
          { key: "habits", label: "Habits" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "relative z-10 py-2.5 text-sm font-bold transition-colors duration-300",
              activeTab === t.key ? "text-black" : "text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* ------------------ SAVINGS ------------------ */}
          {activeTab === "savings" && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CAFA01]" />
                <p className="text-xs font-bold uppercase tracking-widest text-foreground">Savings</p>
                <span className="text-xs text-muted-foreground">({goals.length})</span>
              </div>
              <button onClick={openCreateGoal} className="relative h-7 px-2.5 flex items-center gap-1 rounded-lg bg-[#CAFA01] text-black text-xs font-bold active:scale-95 transition-transform before:absolute before:-inset-2 before:content-['']">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                New
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center py-8 text-muted-foreground gap-1.5">
                <PiggyBank className="h-7 w-7 opacity-30" />
                <p className="text-sm">No savings goals yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {goals.map((g) => {
                  const color = g.color ?? "#CAFA01";
                  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
                  const isPending = g.id < 0;
                  return (
                    <div key={g.id} className={cn("rounded-2xl px-3.5 py-3 transition-opacity", isPending && "opacity-50")} style={{ background: `${color}14` }}>
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => setGoalDetailId(g.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
                            <HabitIcon icon={g.icon} className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold leading-tight truncate">{g.name}</p>
                              {isPending && <span className="text-[10px] font-semibold text-muted-foreground shrink-0">Saving…</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                              {symbol} {fmtMoney(g.currentAmount)} <span className="opacity-60">/ {symbol} {fmtMoney(g.targetAmount)}</span>
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => { if (isPending) return; setAddMoneyGoal(g); setAddAmount(""); }}
                          disabled={isPending}
                          className="h-9 px-3 flex items-center gap-1 rounded-lg text-black text-xs font-bold active:scale-90 transition-transform shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                          {symbol}
                        </button>
                      </div>
                      <button onClick={() => setGoalDetailId(g.id)} className="w-full mt-2" disabled={isPending}>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: `${color}22` }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* ------------------ HABITS ------------------ */}
          {activeTab === "habits" && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CAFA01]" />
                <p className="text-xs font-bold uppercase tracking-widest text-foreground">Habits</p>
                <span className="text-xs text-muted-foreground">({habits.length})</span>
              </div>
              <button onClick={openCreateHabit} className="relative h-7 px-2.5 flex items-center gap-1 rounded-lg bg-[#CAFA01] text-black text-xs font-bold active:scale-95 transition-transform before:absolute before:-inset-2 before:content-['']">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                New
              </button>
            </div>

            {habits.length === 0 ? (
              <div className="bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center py-8 text-muted-foreground gap-1.5">
                <Target className="h-7 w-7 opacity-30" />
                <p className="text-sm">No habits yet. Create one to start a streak.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {habits.map((h) => {
                  const color = h.color ?? "#CAFA01";
                  const logged = new Set(h.logs);
                  const doneToday = logged.has(today);
                  return (
                    <div key={h.id} className="rounded-2xl px-3.5 py-3 space-y-2" style={{ background: `${color}10` }}>
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => setDetailId(h.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
                            <HabitIcon icon={h.icon} className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0 flex items-center gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide leading-tight truncate">{h.name}</p>
                            {h.streak > 0 && (
                              <span className="flex items-center gap-0.5 shrink-0">
                                <Flame className="h-3 w-3" style={{ color }} />
                                <span className="text-[11px] text-muted-foreground font-semibold">{h.streak}</span>
                              </span>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => { if (h.id < 0) return; toggleLog.mutate({ id: h.id, date: today }); }}
                          aria-label={doneToday ? `Mark ${h.name} as not done today` : `Mark ${h.name} as done today`}
                          aria-pressed={doneToday}
                          className="relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 before:absolute before:-inset-1 before:content-['']"
                          style={{ backgroundColor: doneToday ? color : `${color}30` }}
                        >
                          <Check className="h-4 w-4" style={{ color: doneToday ? "#000" : color }} strokeWidth={3} />
                        </button>
                      </div>
                      <button onClick={() => setDetailId(h.id)} className="w-full">
                        <Heatmap weeks={heatmapWeeks} logged={logged} color={color} compact />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* ------------------ FLOWS ------------------ */}
          {activeTab === "bills" && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CAFA01]" />
                <p className="text-xs font-bold uppercase tracking-widest text-foreground">Flows</p>
                <span className="text-xs text-muted-foreground">({bills.length})</span>
              </div>
              <button onClick={openCreateBill} className="relative h-7 px-2.5 flex items-center gap-1 rounded-lg bg-[#CAFA01] text-black text-xs font-bold active:scale-95 transition-transform before:absolute before:-inset-2 before:content-['']">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                New
              </button>
            </div>

            {bills.length === 0 ? (
              <div className="bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center py-8 text-muted-foreground gap-1.5">
                <CreditCard className="h-7 w-7 opacity-30" />
                <p className="text-sm">No recurring flows yet.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {([
                  ["expense", "Money Out", "#FF3B3B", expenseCategories],
                  ["income", "Money In", "#1DB954", incomeCategories],
                ] as const).map(([sectionType, label, dotColor, categoryList]) => {
                  const sectionBills = bills
                    .filter((b) => b.type === sectionType)
                    .slice()
                    .sort((a, b) => a.day - b.day);
                  if (sectionBills.length === 0) return null;
                  return (
                    <div key={sectionType}>
                      <div className="flex items-center gap-2 mb-1.5 px-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                        <p className="text-xs font-bold uppercase tracking-widest text-foreground">{label}</p>
                        <span className="text-xs text-muted-foreground">({sectionBills.length})</span>
                      </div>
                      <div className="space-y-1.5">
                        {sectionBills.map((b) => {
                          const color = b.color ?? "#CAFA01";
                          const logged = new Set(b.logs);
                          const category = categoryList.find((c: any) => c.id === b.categoryId);
                          const isPending = b.id < 0;
                          return (
                            <div key={b.id} className={cn("rounded-2xl px-3.5 py-3 space-y-2 transition-opacity", isPending && "opacity-50")} style={{ background: `${color}10` }}>
                              <div className="flex items-center justify-between gap-2">
                                <button onClick={() => setBillDetailId(b.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
                                    <span className="text-[13px] font-black leading-none" style={{ color }}>{b.day}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold uppercase tracking-wide leading-tight truncate">{b.name}</p>
                                      {isPending && <span className="text-[10px] font-semibold text-muted-foreground shrink-0">Saving…</span>}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-tight truncate">
                                      {b.amount ? `${symbol} ${fmtMoney(b.amount)}` : category?.name ?? "No category"}
                                      {b.autoSave && " · Auto-save"}
                                    </p>
                                  </div>
                                </button>
                                <button
                                  onClick={() => handleToggleBillMonth(b, currentMonthKey())}
                                  disabled={isPending}
                                  aria-label={b.paidThisMonth ? `Mark ${b.name} as unpaid this month` : `Mark ${b.name} as paid this month`}
                                  aria-pressed={b.paidThisMonth}
                                  className="relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-90 before:absolute before:-inset-1 before:content-['']"
                                  style={{ backgroundColor: b.paidThisMonth ? color : `${color}30` }}
                                >
                                  <Check className="h-4 w-4" style={{ color: b.paidThisMonth ? "#000" : color }} strokeWidth={3} />
                                </button>
                              </div>
                              <button onClick={() => setBillDetailId(b.id)} className="w-full" disabled={isPending}>
                                <MonthHeatmap months={billMonths} logged={logged} color={color} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </>
      )}

      {/* ------------------ MODALES ------------------ */}

      {/* Agregar dinero a una meta */}
      <FloatingModal
        open={addMoneyGoal !== null}
        onClose={() => setAddMoneyGoal(null)}
        title={addMoneyGoal ? `Add to ${addMoneyGoal.name}` : ""}
      >
        {addMoneyGoal && (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{symbol}</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={addAmount}
                onChange={(e) => setAddAmount(formatAmountInput(e.target.value))}
                className="rounded-2xl pl-10 text-lg font-bold"
              />
            </div>
            <div className="flex gap-1.5">
              {[50, 100, 500, 1000].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAddAmount(formatAmountInput(String(parseAmountInput(addAmount) + q)))}
                  className="flex-1 py-1.5 rounded-xl bg-muted text-xs font-bold active:scale-95 transition-transform"
                >
                  +{q}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {symbol} {fmtMoney(addMoneyGoal.currentAmount)} → {symbol} {fmtMoney(addMoneyGoal.currentAmount + parseAmountInput(addAmount))}
            </p>
            <Button
              onClick={handleAddMoneySubmit}
              disabled={createTransaction.isPending || createCategory.isPending}
              className="w-full bg-black text-white hover:bg-black/85 border-0 rounded-2xl font-bold"
            >
              Add {symbol} {addAmount || "0"}
            </Button>
          </div>
        )}
      </FloatingModal>

      <FloatingModal open={goalModal !== null} onClose={() => setGoalModal(null)} title={goalModal === "create" ? "New Goal" : "Edit Goal"}>
        <GoalForm form={goalForm} onSubmit={onGoalSubmit} isPending={createGoal.isPending || updateGoal.isPending} submitLabel={goalModal === "create" ? "Create" : "Save"} symbol={symbol} />
      </FloatingModal>

      <FloatingModal open={habitModal !== null} onClose={() => setHabitModal(null)} title={habitModal === "create" ? "New Habit" : "Edit Habit"}>
        <HabitForm form={habitForm} onSubmit={onHabitSubmit} isPending={createHabit.isPending || updateHabit.isPending} submitLabel={habitModal === "create" ? "Create" : "Save"} />
      </FloatingModal>

      <FloatingModal open={billModal !== null} onClose={() => setBillModal(null)} title={billModal === "create" ? "New Flow" : "Edit Flow"}>
        <BillForm
          form={billForm}
          onSubmit={onBillSubmit}
          isPending={createBill.isPending || updateBill.isPending}
          submitLabel={billModal === "create" ? "Create" : "Save"}
          symbol={symbol}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      </FloatingModal>

      {/* Marcar bill como pagado — pide el monto real para auto-save */}
      <FloatingModal
        open={payBill !== null}
        onClose={() => { setPayBill(null); setPayMonth(null); }}
        title={payBill && payMonth ? `Mark "${payBill.name}" as paid` : ""}
      >
        {payBill && payMonth && (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{symbol}</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(formatAmountInput(e.target.value))}
                onBlur={() => {
                  const n = parseAmountInput(payAmount);
                  setPayAmount(n ? fmtMoney(n) : "");
                }}
                className="rounded-2xl pl-10 text-lg font-bold"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              This creates a real expense in Transactions for {fmtMonthLabel(payMonth)}.
            </p>
            <Button
              onClick={handlePaySubmit}
              disabled={createTransaction.isPending || !parseAmountInput(payAmount)}
              className="w-full bg-black text-white hover:bg-black/85 border-0 rounded-2xl font-bold"
            >
              Confirm {symbol} {payAmount || "0"}
            </Button>
          </div>
        )}
      </FloatingModal>

      {detailHabit && (
        <HabitDetail
          habit={detailHabit}
          onClose={() => setDetailId(null)}
          onToggleDay={(date) => { if (detailHabit.id < 0) return; toggleLog.mutate({ id: detailHabit.id, date }); }}
          onEdit={() => { setDetailId(null); openEditHabit(detailHabit); }}
          onDelete={() => deleteHabit.mutate(detailHabit.id)}
        />
      )}

      {detailBill && (
        <BillDetail
          bill={detailBill}
          category={(detailBill.type === "income" ? incomeCategories : expenseCategories).find((c: any) => c.id === detailBill.categoryId)}
          symbol={symbol}
          onClose={() => setBillDetailId(null)}
          onToggleMonth={(month) => handleToggleBillMonth(detailBill, month)}
          onEdit={() => { setBillDetailId(null); openEditBill(detailBill); }}
          onDelete={(deleteTransactions) => { setBillDetailId(null); deleteBill.mutate({ id: detailBill.id, deleteTransactions }); }}
        />
      )}

      {detailGoal && (
        <GoalDetail
          goal={detailGoal}
          symbol={symbol}
          onClose={() => setGoalDetailId(null)}
          onAddMoney={() => { setGoalDetailId(null); setAddMoneyGoal(detailGoal); setAddAmount(""); }}
          onEdit={() => { setGoalDetailId(null); openEditGoal(detailGoal); }}
          onDelete={() => { setGoalDetailId(null); deleteGoal.mutate(detailGoal.id); }}
        />
      )}
    </div>
  );
}
