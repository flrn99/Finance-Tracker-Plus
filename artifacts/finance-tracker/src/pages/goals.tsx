import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
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
  Plus,
  X,
  Check,
  Pencil,
  Trash2,
  Flame,
  ChevronLeft,
  ChevronRight,
  Target,
  PiggyBank,
  Wallet,
  Ban,
  Coffee,
  ShoppingBag,
  Utensils,
  Candy,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

// Si prefieres, reemplaza esta constante por tu export de "@/lib/api-config"
const API_BASE = `${import.meta.env.VITE_API_URL ?? "https://finance-tracker-api-087e.onrender.com"}/api`;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
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
  logs: string[]; // ["YYYY-MM-DD", ...]
  streak: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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
};

const ICON_KEYS = Object.keys(ICONS);

const PRESET_COLORS = [
  "#A8FF3E", "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1",
  "#a855f7", "#ec4899", "#f43f5e", "#f97316", "#eab308",
];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return toKey(new Date());
}

/** Semanas (columnas de 7 días, lunes arriba) terminando en la semana actual */
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

function HabitIcon({ icon, className, style }: { icon: string | null; className?: string; style?: React.CSSProperties }) {
  const Comp = (icon && ICONS[icon]) || Target;
  return <Comp className={className} style={style} />;
}

/* ------------------------------------------------------------------ */
/* Modal flotante (mismo patrón que categories)                        */
/* ------------------------------------------------------------------ */

function FloatingModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed z-50 flex items-center justify-center px-5"
      style={{ top: 0, left: 0, right: 0, bottom: 0, height: "100dvh", width: "100vw" }}
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
        className="relative w-full max-w-sm bg-card rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-[90dvh] overflow-y-auto"
        style={{ willChange: "transform, opacity", transform: "translate3d(0,0,0)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <p className="font-bold text-base">{title}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pickers de color e ícono                                            */
/* ------------------------------------------------------------------ */

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="h-4 w-4 text-black" />}
        </button>
      ))}
    </div>
  );
}

function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ICON_KEYS.map((key) => {
        const Comp = ICONS[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90",
              active ? "" : "bg-muted"
            )}
            style={active ? { backgroundColor: `${color}30` } : undefined}
          >
            <Comp className="h-5 w-5" style={{ color: active ? color : undefined }} />
          </button>
        );
      })}
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
  form,
  onSubmit,
  isPending,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<GoalFormValues>>;
  onSubmit: (data: GoalFormValues) => void;
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
                  <Input type="number" inputMode="decimal" step="any" placeholder="5000" className="rounded-2xl" {...field} />
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
                  <Input type="number" inputMode="decimal" step="any" placeholder="0" className="rounded-2xl" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <ColorPicker value={field.value} onChange={field.onChange} />
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
  form,
  onSubmit,
  isPending,
  submitLabel,
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
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Icon</FormLabel>
              <IconPicker value={field.value} onChange={field.onChange} color={color} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <ColorPicker value={field.value} onChange={field.onChange} />
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
/* Heatmap (estilo HabitKit)                                           */
/* ------------------------------------------------------------------ */

function Heatmap({
  weeks,
  logged,
  color,
  cellRadius = 3,
}: {
  weeks: string[][];
  logged: Set<string>;
  color: string;
  cellRadius?: number;
}) {
  const today = todayKey();
  return (
    <div
      className="w-full"
      style={{
        display: "grid",
        gridTemplateRows: "repeat(7, 1fr)",
        gridAutoFlow: "column",
        gridAutoColumns: "1fr",
        gap: "3px",
      }}
    >
      {weeks.map((week, wi) =>
        week.map((day, di) => {
          const isFuture = day > today;
          const isDone = logged.has(day);
          return (
            <div
              key={`${wi}-${di}`}
              className="aspect-square"
              style={{
                gridColumn: wi + 1,
                gridRow: di + 1,
                borderRadius: `${cellRadius}px`,
                backgroundColor: isFuture
                  ? "transparent"
                  : isDone
                    ? color
                    : `${color}26`,
              }}
            />
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal de detalle de hábito                                          */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HabitDetail({
  habit,
  onClose,
  onToggleDay,
  onEdit,
  onDelete,
  togglingDate,
}: {
  habit: Habit;
  onClose: () => void;
  onToggleDay: (date: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  togglingDate: string | null;
}) {
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const color = habit.color ?? "#A8FF3E";
  const logged = useMemo(() => new Set(habit.logs), [habit.logs]);
  const weeks = useMemo(() => buildWeeks(26), []);
  const today = todayKey();

  // Grid del mes: lunes primero
  const monthDays = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const cells: { key: string; day: number; inMonth: boolean }[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i++) {
      cells.push({
        key: toKey(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month.m,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [month]);

  const prevMonth = () =>
    setMonth((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }));
  const nextMonth = () =>
    setMonth((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }));

  return (
    <FloatingModal open onClose={onClose} title="">
      <div className="-mt-8 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
            <HabitIcon icon={habit.icon} className="h-5 w-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg leading-tight uppercase tracking-wide truncate">{habit.name}</p>
          </div>
        </div>

        {/* Heatmap 6 meses */}
        <Heatmap weeks={weeks} logged={logged} color={color} cellRadius={2} />

        {/* Streak + acciones */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
            <Flame className="h-4 w-4" style={{ color }} />
            <span className="text-sm font-bold">{habit.streak}</span>
            <span className="text-xs text-muted-foreground">day streak</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="h-9 w-9 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="h-9 w-9 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="h-4 w-4" />
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
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Calendario mensual — tap para marcar/desmarcar */}
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
              const busy = togglingDate === cell.key;
              return (
                <button
                  key={cell.key}
                  disabled={isFuture || busy}
                  onClick={() => onToggleDay(cell.key)}
                  className={cn(
                    "aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition-all active:scale-90",
                    !cell.inMonth && "opacity-30",
                    isFuture && "opacity-20",
                    busy && "opacity-50"
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
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm font-bold">{MONTHS[month.m]} {month.y}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center rounded-2xl bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} className="h-8 w-8 flex items-center justify-center rounded-2xl bg-muted">
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

  const [goalModal, setGoalModal] = useState<"create" | number | null>(null); // number = editar ese id
  const [habitModal, setHabitModal] = useState<"create" | number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);

  /* ---------- queries ---------- */

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => api<Goal[]>("/goals"),
  });

  const habitsQuery = useQuery({
    queryKey: ["habits"],
    queryFn: () => api<Habit[]>("/habits"),
  });

  const invalidateGoals = () => queryClient.invalidateQueries({ queryKey: ["goals"] });
  const invalidateHabits = () => queryClient.invalidateQueries({ queryKey: ["habits"] });

  /* ---------- mutations: goals ---------- */

  const createGoal = useMutation({
    mutationFn: (data: GoalFormValues) => api("/goals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Goal created" }); invalidateGoals(); setGoalModal(null); },
    onError: () => toast({ title: "Failed to create goal", variant: "destructive" }),
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GoalFormValues }) =>
      api(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Goal updated" }); invalidateGoals(); setGoalModal(null); },
    onError: () => toast({ title: "Failed to update goal", variant: "destructive" }),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: number) => api(`/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Goal deleted" }); invalidateGoals(); },
    onError: () => toast({ title: "Failed to delete goal", variant: "destructive" }),
  });

  /* ---------- mutations: habits ---------- */

  const createHabit = useMutation({
    mutationFn: (data: HabitFormValues) => api("/habits", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Habit created" }); invalidateHabits(); setHabitModal(null); },
    onError: () => toast({ title: "Failed to create habit", variant: "destructive" }),
  });

  const updateHabit = useMutation({
    mutationFn: ({ id, data }: { id: number; data: HabitFormValues }) =>
      api(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "Habit updated" }); invalidateHabits(); setHabitModal(null); },
    onError: () => toast({ title: "Failed to update habit", variant: "destructive" }),
  });

  const deleteHabit = useMutation({
    mutationFn: (id: number) => api(`/habits/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Habit deleted" }); invalidateHabits(); setDetailId(null); },
    onError: () => toast({ title: "Failed to delete habit", variant: "destructive" }),
  });

  const toggleLog = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/habits/${id}/logs/${date}`, { method: "PUT" }),
    onMutate: ({ date }) => setTogglingDate(date),
    onSettled: () => setTogglingDate(null),
    onSuccess: () => invalidateHabits(),
    onError: () => toast({ title: "Failed to update day", variant: "destructive" }),
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
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      icon: g.icon ?? "piggybank",
      color: g.color ?? "#A8FF3E",
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
  const heatmapWeeks = useMemo(() => buildWeeks(18), []);
  const today = todayKey();
  const detailHabit = detailId !== null ? habits.find((h) => h.id === detailId) ?? null : null;

  const isLoading = goalsQuery.isLoading || habitsQuery.isLoading;

  /* ---------- render ---------- */

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Goals</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* ------------------ SAVINGS GOALS ------------------ */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#A8FF3E]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#7DD900]">Savings</p>
                <span className="text-xs text-muted-foreground">({goals.length})</span>
              </div>
              <button
                onClick={openCreateGoal}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-[#A8FF3E] text-black active:scale-90 transition-transform"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <PiggyBank className="h-8 w-8 opacity-30" />
                <p className="text-sm">No savings goals yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {goals.map((g) => {
                  const color = g.color ?? "#A8FF3E";
                  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
                  return (
                    <div key={g.id} className="bg-card rounded-2xl shadow-sm p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
                            <HabitIcon icon={g.icon} className="h-5 w-5" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-tight truncate">{g.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {g.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => openEditGoal(g)}
                            className="h-7 w-7 flex items-center justify-center rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="h-7 w-7 flex items-center justify-center rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete "{g.name}"? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteGoal.mutate(g.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="text-xs font-bold shrink-0" style={{ color }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ------------------ HABITS ------------------ */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#A8FF3E]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#7DD900]">Habits</p>
                <span className="text-xs text-muted-foreground">({habits.length})</span>
              </div>
              <button
                onClick={openCreateHabit}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-[#A8FF3E] text-black active:scale-90 transition-transform"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {habits.length === 0 ? (
              <div className="bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Target className="h-8 w-8 opacity-30" />
                <p className="text-sm">No habits yet. Create one to start a streak.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {habits.map((h) => {
                  const color = h.color ?? "#A8FF3E";
                  const logged = new Set(h.logs);
                  const doneToday = logged.has(today);
                  return (
                    <div key={h.id} className="bg-card rounded-2xl shadow-sm p-4 space-y-3">
                      {/* Fila superior — tap abre detalle, check marca hoy */}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => setDetailId(h.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}25` }}>
                            <HabitIcon icon={h.icon} className="h-5 w-5" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold uppercase tracking-wide leading-tight truncate">{h.name}</p>
                            {h.streak > 0 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Flame className="h-3 w-3" style={{ color }} />
                                <span className="text-xs text-muted-foreground font-semibold">{h.streak}</span>
                              </div>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => toggleLog.mutate({ id: h.id, date: today })}
                          disabled={toggleLog.isPending}
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90"
                          style={{
                            backgroundColor: doneToday ? color : `${color}20`,
                          }}
                        >
                          <Check
                            className="h-5 w-5"
                            style={{ color: doneToday ? "#000" : color }}
                            strokeWidth={3}
                          />
                        </button>
                      </div>

                      {/* Heatmap */}
                      <button onClick={() => setDetailId(h.id)} className="w-full">
                        <Heatmap weeks={heatmapWeeks} logged={logged} color={color} />
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

      <FloatingModal
        open={goalModal !== null}
        onClose={() => setGoalModal(null)}
        title={goalModal === "create" ? "New Goal" : "Edit Goal"}
      >
        <GoalForm
          form={goalForm}
          onSubmit={onGoalSubmit}
          isPending={createGoal.isPending || updateGoal.isPending}
          submitLabel={goalModal === "create" ? "Create" : "Save"}
        />
      </FloatingModal>

      <FloatingModal
        open={habitModal !== null}
        onClose={() => setHabitModal(null)}
        title={habitModal === "create" ? "New Habit" : "Edit Habit"}
      >
        <HabitForm
          form={habitForm}
          onSubmit={onHabitSubmit}
          isPending={createHabit.isPending || updateHabit.isPending}
          submitLabel={habitModal === "create" ? "Create" : "Save"}
        />
      </FloatingModal>

      {detailHabit && (
        <HabitDetail
          habit={detailHabit}
          onClose={() => setDetailId(null)}
          onToggleDay={(date) => toggleLog.mutate({ id: detailHabit.id, date })}
          onEdit={() => { setDetailId(null); openEditHabit(detailHabit); }}
          onDelete={() => deleteHabit.mutate(detailHabit.id)}
          togglingDate={togglingDate}
        />
      )}
    </div>
  );
}
