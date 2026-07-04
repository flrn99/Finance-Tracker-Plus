import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCurrency, CURRENCY_INFO } from "@/lib/currency-context";
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
  Plus, X, Check, Pencil, Trash2, Flame, ChevronLeft, ChevronRight,
  Target, PiggyBank, Wallet, Ban, Coffee, ShoppingBag, Utensils, Candy,
  Dumbbell, Cigarette, Beer, Car, Gamepad2, Shirt, Smartphone, Plane,
  Home, Gift, BookOpen, Music,
} from "lucide-react";

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

interface Habit {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: string;
  logs: string[];
  streak: number;
}

/* ------------------------------------------------------------------ */
/* Icons & colors                                                      */
/* ------------------------------------------------------------------ */

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
};

const ICON_KEYS = Object.keys(ICONS);

const COLOR_OPTIONS: { hex: string; name: string }[] = [
  { hex: "#A8FF3E", name: "Flow Green" },
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

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{
        // respeta status bar y nav — el modal nunca los invade
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-black/80 animate-in fade-in-0 duration-200"
        style={{
          position: "fixed",
          top: "-10vh", left: "-10vw", right: "-10vw", bottom: "-10vh",
          width: "120vw", height: "120dvh",
        }}
      />
      <div
        className="relative w-full max-w-sm bg-card rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-full overflow-y-auto"
        style={{ willChange: "transform, opacity", transform: "translate3d(0,0,0)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-bold text-base">{title}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-2xl">
        <SelectValue placeholder="Pick a color" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {COLOR_OPTIONS.map((c) => (
          <SelectItem key={c.hex} value={c.hex}>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <div className="relative">
      <div
        className="flex gap-2 overflow-x-auto py-1 px-0.5"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {ICON_KEYS.map((key) => {
          const Comp = ICONS[key];
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Vacation fund" className="rounded-2xl" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="targetAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">{symbol}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="5,000.00"
                      className="rounded-2xl pl-8"
                      value={field.value ? formatAmountInput(String(field.value)) : ""}
                      onChange={(e) => field.onChange(parseAmountInput(formatAmountInput(e.target.value)))}
                    />
                  </div>
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
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">{symbol}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="rounded-2xl pl-8"
                      value={field.value ? formatAmountInput(String(field.value)) : ""}
                      onChange={(e) => field.onChange(parseAmountInput(formatAmountInput(e.target.value)))}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
              <IconPicker value={field.value} onChange={field.onChange} color={color} />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0 rounded-2xl">
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. No delivery" className="rounded-2xl" {...field} />
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
              <IconPicker value={field.value} onChange={field.onChange} color={color} />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending} className="w-full bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0 rounded-2xl">
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
                backgroundColor: isFuture ? "transparent" : isDone ? color : `${color}22`,
              }}
            />
          );
        })
      )}
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
  const color = habit.color ?? "#A8FF3E";
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
            <button onClick={onEdit} className="h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-all">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Habit</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete "{habit.name}" and all its history? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
              <button onClick={prevMonth} className="h-7 w-7 flex items-center justify-center rounded-xl bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} className="h-7 w-7 flex items-center justify-center rounded-xl bg-muted">
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
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function Goals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [goalModal, setGoalModal] = useState<"create" | number | null>(null);
  const [habitModal, setHabitModal] = useState<"create" | number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [addMoneyGoal, setAddMoneyGoal] = useState<Goal | null>(null);
  const [addAmount, setAddAmount] = useState("");

  // Símbolo de la moneda elegida en settings (Q, $, €, ...)
  const { currency } = useCurrency();
  const symbol = ((CURRENCY_INFO as Record<string, any>)[currency]?.symbol as string | undefined) ?? currency;

  const goalsQuery = useQuery({ queryKey: ["goals"], queryFn: () => api<Goal[]>("/goals") });
  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: () => api<Habit[]>("/habits") });

  const invalidateGoals = () => queryClient.invalidateQueries({ queryKey: ["goals"] });
  const invalidateHabits = () => queryClient.invalidateQueries({ queryKey: ["habits"] });

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

  // 💰 Agregar dinero a una meta — solo actualiza currentAmount, optimista
  const addToGoal = useMutation({
    mutationFn: ({ id, newAmount }: { id: number; newAmount: number }) =>
      api(`/goals/${id}`, { method: "PATCH", body: JSON.stringify({ currentAmount: String(newAmount) }) }),
    onMutate: async ({ id, newAmount }) => {
      setAddMoneyGoal(null);
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const prev = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) =>
        (old ?? []).map((g) => (g.id === id ? { ...g, currentAmount: newAmount } : g))
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

  /* ---------- forms ---------- */

  const goalForm = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: { name: "", targetAmount: 0, currentAmount: 0, icon: "piggybank", color: "#A8FF3E" },
  });

  const habitForm = useForm<HabitFormValues>({
    resolver: zodResolver(habitSchema),
    defaultValues: { name: "", icon: "ban", color: "#A8FF3E" },
  });

  const openCreateGoal = () => {
    goalForm.reset({ name: "", targetAmount: 0, currentAmount: 0, icon: "piggybank", color: "#A8FF3E" });
    setGoalModal("create");
  };

  const openEditGoal = (g: Goal) => {
    goalForm.reset({
      name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
      icon: g.icon ?? "piggybank", color: g.color ?? "#A8FF3E",
    });
    setGoalModal(g.id);
  };

  const openCreateHabit = () => {
    habitForm.reset({ name: "", icon: "ban", color: "#A8FF3E" });
    setHabitModal("create");
  };

  const openEditHabit = (h: Habit) => {
    habitForm.reset({ name: h.name, icon: h.icon ?? "ban", color: h.color ?? "#A8FF3E" });
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

  /* ---------- derived ---------- */

  const goals = goalsQuery.data ?? [];
  const habits = habitsQuery.data ?? [];
  const heatmapWeeks = useMemo(() => buildWeeks(30), []);
  const today = todayKey();
  const detailHabit = detailId !== null ? habits.find((h) => h.id === detailId) ?? null : null;
  const isLoading = goalsQuery.isLoading || habitsQuery.isLoading;

  /* ---------- render ---------- */

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold tracking-tight pr-14 min-h-10 flex items-center">Goals</h2>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* ------------------ SAVINGS ------------------ */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#A8FF3E]" />
                <p className="text-xs font-bold uppercase tracking-widest text-foreground">Savings</p>
                <span className="text-xs text-muted-foreground">({goals.length})</span>
              </div>
              <button onClick={openCreateGoal} className="h-7 px-2.5 flex items-center gap-1 rounded-lg bg-[#A8FF3E] text-black text-xs font-bold active:scale-95 transition-transform">
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
                  const color = g.color ?? "#A8FF3E";
                  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
                  return (
                    <div key={g.id} className="bg-card rounded-2xl shadow-sm px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
                            <HabitIcon icon={g.icon} className="h-4 w-4" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-tight truncate">{g.name}</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                              {symbol} {fmtMoney(g.currentAmount)} <span className="opacity-60">/ {symbol} {fmtMoney(g.targetAmount)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-bold" style={{ color }}>{Math.round(pct)}%</span>
                          <button
                            onClick={() => { if (g.id < 0) return; setAddMoneyGoal(g); setAddAmount(""); }}
                            className="h-7 px-2 flex items-center gap-0.5 rounded-lg text-black text-[11px] font-bold active:scale-90 transition-transform"
                            style={{ backgroundColor: color }}
                          >
                            <Plus className="h-3 w-3" strokeWidth={3} />
                            {symbol}
                          </button>
                          <button onClick={() => { if (g.id < 0) return; openEditGoal(g); }} className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                <AlertDialogDescription>Delete "{g.name}"? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteGoal.mutate(g.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ------------------ HABITS ------------------ */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#A8FF3E]" />
                <p className="text-xs font-bold uppercase tracking-widest text-foreground">Habits</p>
                <span className="text-xs text-muted-foreground">({habits.length})</span>
              </div>
              <button onClick={openCreateHabit} className="h-7 px-2.5 flex items-center gap-1 rounded-lg bg-[#A8FF3E] text-black text-xs font-bold active:scale-95 transition-transform">
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
                  const color = h.color ?? "#A8FF3E";
                  const logged = new Set(h.logs);
                  const doneToday = logged.has(today);
                  return (
                    <div key={h.id} className="bg-card rounded-2xl shadow-sm px-3 py-2.5 space-y-2">
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
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90"
                          style={{ backgroundColor: doneToday ? color : `${color}20` }}
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
              onClick={() => {
                const n = parseAmountInput(addAmount);
                if (!addMoneyGoal || Number.isNaN(n) || n <= 0) return;
                addToGoal.mutate({ id: addMoneyGoal.id, newAmount: addMoneyGoal.currentAmount + n });
              }}
              className="w-full bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0 rounded-2xl"
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

      {detailHabit && (
        <HabitDetail
          habit={detailHabit}
          onClose={() => setDetailId(null)}
          onToggleDay={(date) => { if (detailHabit.id < 0) return; toggleLog.mutate({ id: detailHabit.id, date }); }}
          onEdit={() => { setDetailId(null); openEditHabit(detailHabit); }}
          onDelete={() => deleteHabit.mutate(detailHabit.id)}
        />
      )}
    </div>
  );
}
