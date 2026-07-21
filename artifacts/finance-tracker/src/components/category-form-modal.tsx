import { useEffect, useRef, useState } from "react";
import {
  useCreateCategory,
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  X, TrendingDown, TrendingUp, Trash2, Tag, Utensils, Car, ShoppingBag, Film,
  HeartPulse, Zap, BookOpen, Home, Plane, Coffee, Gift, Briefcase, Laptop,
  TrendingUp as TrendingUpIcon, Landmark, Wallet, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

// Mismo set de íconos (mismo patrón) que ICONS en goals.tsx — categorías
// tenían el campo icon en el schema desde siempre pero sin picker real, así
// que toda categoría quedaba con "tag" a secas. "tag" sigue siendo el
// fallback/default.
export const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  tag: Tag,
  utensils: Utensils,
  car: Car,
  shoppingbag: ShoppingBag,
  film: Film,
  heartpulse: HeartPulse,
  zap: Zap,
  book: BookOpen,
  home: Home,
  plane: Plane,
  coffee: Coffee,
  gift: Gift,
  briefcase: Briefcase,
  laptop: Laptop,
  trendingup: TrendingUpIcon,
  landmark: Landmark,
  wallet: Wallet,
  creditcard: CreditCard,
};
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

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

// Gastos: violeta → rojo → amarillo (los amarillos se sumaron a propósito,
// reabriendo una exclusión de una sesión anterior). Fríos para ingresos,
// con una familia extra de azules — 12 y 12, en orden tonal ascendente.
export const EXPENSE_COLORS = [
  "#8b5cf6", "#c084fc", "#d946ef", "#e879f9",
  "#ec4899", "#f43f5e", "#fb7185", "#ef4444",
  "#fbbf24", "#f59e0b", "#eab308", "#ca8a04",
];
export const INCOME_COLORS = [
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7",
  "#22d3ee", "#0284c7", "#2563eb", "#1e40af",
];

const COLOR_NAMES: Record<string, string> = {
  "#8b5cf6": "Violet",
  "#c084fc": "Lilac",
  "#d946ef": "Fuchsia",
  "#e879f9": "Orchid",
  "#ec4899": "Pink",
  "#f43f5e": "Cherry",
  "#fb7185": "Blush",
  "#ef4444": "Red",
  "#fbbf24": "Amber",
  "#f59e0b": "Honey",
  "#eab308": "Gold",
  "#ca8a04": "Mustard",
  "#84cc16": "Lime",
  "#22c55e": "Green",
  "#14b8a6": "Teal",
  "#06b6d4": "Turquoise",
  "#0ea5e9": "Sky",
  "#3b82f6": "Blue",
  "#6366f1": "Indigo",
  "#a855f7": "Grape",
  "#22d3ee": "Cyan",
  "#0284c7": "Ocean",
  "#2563eb": "Royal",
  "#1e40af": "Navy",
};

function colorLabel(hex: string): string {
  return COLOR_NAMES[hex.toLowerCase()] ?? hex;
}

function hueOf(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d) % 6; break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Categorías creadas antes de un cambio de paleta pueden tener guardado un color
// que ya no se ofrece en el picker (paleta vieja) — se migran solas al color
// vigente de tono más parecido la primera vez que se listan, mismo patrón que
// la migración transparente del PIN en biometric-context.tsx.
export function nearestPaletteColor(oldHex: string, type: string): string {
  const palette = type === "expense" ? EXPENSE_COLORS : type === "income" ? INCOME_COLORS : [...EXPENSE_COLORS, ...INCOME_COLORS];
  const targetHue = hueOf(oldHex);
  let best: string = palette[0]!;
  let bestDist = Infinity;
  for (const c of palette) {
    const dist = hueDistance(hueOf(c), targetHue);
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

export const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#/, "Must be a valid hex color"),
  icon: z.string(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export function FloatingModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  // open controla la intención del padre; mounted/closing quedan un beat más
  // para poder jugar la animación de salida antes de desmontar de un salto
  // (antes "if (!open) return null" lo sacaba instantáneo, sin exit).
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
      aria-label={title}
      className="fixed z-50 flex items-center justify-center px-5"
      style={{
        top: 0, left: 0, right: 0, bottom: 0,
        height: '100dvh',
        width: '100vw',
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      }}
      onClick={onClose}
    >
      <div
        className={cn("bg-black/80 duration-180", closing ? "animate-out fade-out" : "animate-in fade-in")}
        style={{
          position: 'fixed',
          top: '-10vh', left: '-10vw', right: '-10vw', bottom: '-10vh',
          width: '120vw', height: '120dvh',
          // animate-out trae fill-mode:none — sin esto, apenas termina la
          // animación CSS el fondo vuelve a opacity:1 (visible) por un frame
          // antes de que React llegue a desmontarlo. "forwards" mantiene el
          // estado final (invisible) sostenido hasta el desmontaje real.
          animationFillMode: closing ? "forwards" : undefined,
        }}
      />
      <div
        className={cn(
          "relative w-full max-w-xs bg-card rounded-[36px] shadow-2xl duration-180 max-h-full overflow-y-auto",
          closing ? "animate-out fade-out slide-out-to-bottom-4" : "animate-in fade-in slide-in-from-bottom-4"
        )}
        style={{
          willChange: 'transform, opacity',
          transform: 'translate3d(0,0,0)',
          animationFillMode: closing ? "forwards" : undefined,
        }}
        onClick={e => e.stopPropagation()}
        // CSS el elemento vuelve a su estilo de reposo (opacity:1) antes de que
        // React llegue a desmontarlo, y eso flashea. Desmontar en el evento real
        // en vez de adivinar el timing con un timeout elimina esa ventana.
        onAnimationEnd={() => { if (closing) setMounted(false); }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
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

// Mismo patrón visual que IconPicker en goals.tsx (fila con scroll horizontal,
// pill tintada en el ícono activo, fade a la derecha).
function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <div className="relative">
      <div
        className="flex gap-2 overflow-x-auto py-1 px-0.5"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {CATEGORY_ICON_KEYS.map((key) => {
          const Comp = CATEGORY_ICONS[key];
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
        <div className="w-6 shrink-0" />
      </div>
      <div
        className="absolute top-0 right-0 h-full w-10 pointer-events-none rounded-r-lg"
        style={{ background: "linear-gradient(to right, transparent, hsl(var(--card)))" }}
      />
    </div>
  );
}

export function CategoryForm({
  form,
  onSubmit,
  isPending,
  onCancel,
  submitLabel,
  onDelete,
}: {
  form: ReturnType<typeof useForm<CategoryFormValues>>;
  onSubmit: (data: CategoryFormValues) => void;
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
  onDelete?: () => void;
}) {
  const selectedColor = form.watch("color");
  const watchedType = form.watch("type");
  const palette = watchedType === "income" ? INCOME_COLORS : EXPENSE_COLORS;

  // Swipe horizontal sobre el nombre/swatch del stepper de color — mismo
  // mecanismo que el stepper de día en Flows: acumula distancia arrastrada y
  // avanza/retrocede un color cada COLOR_DRAG_STEP_PX, cíclico.
  const COLOR_DRAG_STEP_PX = 28;
  // idx vive en el ref (no solo derivado de field.value/palette.indexOf en cada
  // render) porque si varios pointermove disparan antes de que React confirme
  // el render del field.onChange anterior — normal en un swipe fluido — cada
  // evento arrancaría desde un idx desactualizado y se pisarían los pasos
  // entre sí, perdiendo la mayoría del recorrido. "down" (a diferencia de
  // "active", que marca si ya se cruzó el umbral de 6px) distingue "hay un
  // gesto en curso" de "no hay nada" — sin esto un pointermove sin pointerdown
  // previo (hover con mouse/trackpad, o cualquier evento suelto) procesaría
  // con el x/idx default en vez de ser ignorado.
  const colorDrag = useRef({ x: 0, accum: 0, active: false, idx: 0, down: false });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

        {/* 🔮 Preview vivo — el nombre se escribe directamente aqui */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <div className="rounded-2xl overflow-hidden border border-border">
                <div className="relative w-full h-9" style={{ backgroundColor: selectedColor }}>
                  <div className="absolute -top-5 -right-3 w-14 h-14 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.28)" }} />
                </div>
                <div className="px-3 py-1 flex items-center justify-between gap-2 bg-card">
                  <FormControl>
                    <input
                      aria-label="Category name"
                      placeholder="Category name"
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent border-0 outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground/40 py-1.5"
                      {...field}
                    />
                  </FormControl>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0"
                    style={{
                      background: watchedType === "income" ? "rgba(29,185,84,0.14)" : "rgba(255,59,59,0.12)",
                      color: watchedType === "income" ? "#15803D" : "#B91C1C",
                    }}
                  >
                    {watchedType === "income" ? "Income" : "Expense"}
                  </span>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => {
            const isIncome = field.value === "income";
            return (
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
                      if (!EXPENSE_COLORS.includes(form.getValues("color"))) form.setValue("color", EXPENSE_COLORS[0]);
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
                      if (!INCOME_COLORS.includes(form.getValues("color"))) form.setValue("color", INCOME_COLORS[0]);
                    }}
                    className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors duration-300 rounded-full", isIncome ? "text-white" : "text-foreground/50")}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Income
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* Color — stepper (círculo + nombre + puntos), con swipe horizontal.
            Reemplaza la grilla 2 columnas: con 12 colores por tipo ya no
            entraba cómoda de un vistazo (6 filas). */}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => {
            const idx = Math.max(0, palette.indexOf(field.value));
            const goTo = (i: number) => field.onChange(palette[(i + palette.length) % palette.length]);
            return (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
                <FormControl>
                  <div className="flex flex-col items-center gap-2 py-1">
                    <div className="flex items-center justify-center gap-5">
                      <button
                        type="button"
                        onClick={() => goTo(idx - 1)}
                        className="w-8 h-8 shrink-0 rounded-full bg-muted text-foreground text-sm font-bold flex items-center justify-center active:scale-90 transition-transform"
                      >
                        ‹
                      </button>
                      <div
                        className="flex flex-col items-center gap-1.5 min-w-[112px] select-none touch-none"
                        onPointerDown={(e) => {
                          colorDrag.current = { x: e.clientX, accum: 0, active: false, idx, down: true };
                          // Sin esto, un swipe rápido se escapa del elemento (es angosto,
                          // ~112px) y el navegador deja de mandarle pointermove/pointerup —
                          // el próximo intento quedaba con "active" trabado en true. Mismo
                          // fix que ya usa el swipe de Transactions y el numpad.
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          const st = colorDrag.current;
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
                          let i = st.idx;
                          while (st.accum >= COLOR_DRAG_STEP_PX) { i = (i + 1) % palette.length; st.accum -= COLOR_DRAG_STEP_PX; }
                          while (st.accum <= -COLOR_DRAG_STEP_PX) { i = (i - 1 + palette.length) % palette.length; st.accum += COLOR_DRAG_STEP_PX; }
                          // Un solo haptic por evento (no uno por paso del while) — en un
                          // flick rápido que cruce varios colores de una, un tick por paso
                          // se sentiría como un buzz en vez de un detent nítido.
                          if (i !== st.idx) { st.idx = i; field.onChange(palette[i]); triggerHaptic(); }
                        }}
                        onPointerUp={(e) => {
                          colorDrag.current.active = false;
                          colorDrag.current.down = false;
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                        onPointerCancel={(e) => {
                          colorDrag.current.active = false;
                          colorDrag.current.down = false;
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                        }}
                      >
                        <div
                          className="w-11 h-11 rounded-full shadow-md transition-[background-color] duration-200"
                          style={{ background: field.value, boxShadow: "0 4px 14px -2px rgba(0,0,0,0.28)" }}
                        />
                        {/* key=idx: remonta el span en cada paso para que el nombre
                            entre con un fade en vez de cambiar de texto de un salto. */}
                        <span key={idx} className="text-sm font-bold animate-in fade-in duration-150">
                          {colorLabel(field.value)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => goTo(idx + 1)}
                        className="w-8 h-8 shrink-0 rounded-full bg-muted text-foreground text-sm font-bold flex items-center justify-center active:scale-90 transition-transform"
                      >
                        ›
                      </button>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-center max-w-[170px]">
                      {palette.map((c, i) => (
                        <span
                          key={c}
                          className="transition-all"
                          style={{
                            width: i === idx ? 14 : 5,
                            height: 5,
                            borderRadius: 3,
                            background: i === idx ? field.value : "hsl(var(--muted-foreground) / 0.25)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Icon</FormLabel>
              <FormControl>
                <IconPicker value={field.value} onChange={field.onChange} color={selectedColor} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-2xl bg-muted text-foreground text-sm font-semibold border-0">Cancel</button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-2xl bg-black text-white text-sm font-bold border-0 disabled:opacity-60">
            {isPending ? "Saving..." : submitLabel}
          </button>
        </div>

        {onDelete && (
          <ConfirmDialog
            trigger={
              <button type="button" className="w-full py-1.5 text-xs font-semibold text-destructive/70 hover:text-destructive transition-colors">
                Delete category
              </button>
            }
            icon={Trash2}
            title="Delete Category"
            description="This cannot be undone, and will fail if any transactions use this category."
            confirmLabel="Delete"
            onConfirm={onDelete}
          />
        )}
      </form>
    </Form>
  );
}

/** Modal de creación de categoría, autocontenido (form + mutation + invalidación).
 * Usado por Categories (botón "New Category") y por EntrySheet (chip "Add" del
 * picker de categorías) — antes ese chip navegaba a /categories y perdía todo
 * lo que ya se había tipeado en el entry; ahora se apila encima sin desmontarlo. */
export function CreateCategoryModal({
  open,
  onClose,
  defaultType = "expense",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultType?: "expense" | "income";
  onCreated?: (category: any) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCategory = useCreateCategory();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: defaultType, color: defaultType === "income" ? INCOME_COLORS[1] : EXPENSE_COLORS[3], icon: "tag" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: "",
      type: defaultType,
      color: defaultType === "income" ? INCOME_COLORS[1] : EXPENSE_COLORS[3],
      icon: "tag",
    });
  }, [open, defaultType]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
  };

  const onSubmit = (data: CategoryFormValues) => {
    createCategory.mutate({ data }, {
      onSuccess: (created) => {
        toast({ title: "Category created" });
        invalidate();
        onCreated?.(created);
        onClose();
      },
      onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
    });
  };

  return (
    <FloatingModal open={open} onClose={onClose} title="New Category">
      <CategoryForm
        form={form}
        onSubmit={onSubmit}
        isPending={createCategory.isPending}
        onCancel={onClose}
        submitLabel="Create"
      />
    </FloatingModal>
  );
}
