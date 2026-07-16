import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  useListCategories,
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, TrendingDown, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, categoryTextColor, compositeHex, LIGHT_CARD_BG, DARK_CARD_BG } from "@/lib/utils";

const PILL_TINT_ALPHA = 0x1f / 255;
import { ConfirmDialog } from "@/components/confirm-dialog";

// Gastos: rojo → violeta, sin amarillos ni naranjas (se sacaron a propósito).
// Fríos para ingresos — 8 y 8, en orden tonal ascendente.
const EXPENSE_COLORS = [
  "#8b5cf6", "#c084fc", "#d946ef", "#e879f9",
  "#ec4899", "#f43f5e", "#fb7185", "#ef4444",
];
const INCOME_COLORS = [
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7",
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
  "#84cc16": "Lime",
  "#22c55e": "Green",
  "#14b8a6": "Teal",
  "#06b6d4": "Turquoise",
  "#0ea5e9": "Sky",
  "#3b82f6": "Blue",
  "#6366f1": "Indigo",
  "#a855f7": "Grape",
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
function nearestPaletteColor(oldHex: string, type: string): string {
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


const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#/, "Must be a valid hex color"),
  icon: z.string()
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expense",
};

function FloatingModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  // Bloquea el swipe de página del nav mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return (
    <div
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
        className="bg-black/80"
        style={{
          position: 'fixed',
          top: '-10vh', left: '-10vw', right: '-10vw', bottom: '-10vh',
          width: '120vw', height: '120dvh',
        }}
      />
      <div
        className="relative w-full max-w-xs bg-card rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-full overflow-y-auto"
        style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
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

function CategoryForm({
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

        {/* Color — pills tintados segun el tipo */}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <FormControl>
                <div className="grid grid-cols-2 gap-1.5">
                  {palette.map((color) => {
                    const active = field.value === color;
                    // Vuelve al tinte pastel (más "cool" que el bloque sólido), pero el
                    // texto ya no es el color a full intensidad — es la variante más
                    // cercana que sigue pasando 4.5:1 contra el tinte compuesto real
                    // (mismo hue, ajustado en OKLCH), calculada para cada tema.
                    const tintLight = compositeHex(color, LIGHT_CARD_BG, PILL_TINT_ALPHA);
                    const tintDark = compositeHex(color, DARK_CARD_BG, PILL_TINT_ALPHA);
                    const textLight = categoryTextColor(color, tintLight);
                    const textDark = categoryTextColor(color, tintDark);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => field.onChange(color)}
                        className="cat-name-text flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.96]"
                        style={{
                          background: `${color}1F`,
                          boxShadow: active ? `inset 0 0 0 1.5px ${color}` : "none",
                          "--cat-text-light": textLight,
                          "--cat-text-dark": textDark,
                        } as CSSProperties}
                      >
                        {colorLabel(color)}
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
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

export default function Categories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: categories, isLoading } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() }
  });

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Migración transparente de colores viejos (paleta pre-rediseño) al color
  // vigente más parecido — una sola pasada por sesión, silenciosa.
  const hasMigratedColors = useRef(false);
  useEffect(() => {
    if (hasMigratedColors.current || !Array.isArray(categories)) return;
    const allCurrentColors = new Set([...EXPENSE_COLORS, ...INCOME_COLORS]);
    const stale = categories.filter((c) => !allCurrentColors.has(c.color.toLowerCase()));
    if (stale.length === 0) return;
    hasMigratedColors.current = true;
    stale.forEach((c) => {
      updateCategory.mutate(
        { id: c.id, data: { color: nearestPaletteColor(c.color, c.type) } },
        { onSuccess: () => invalidate() }
      );
    });
  }, [categories]);

  const createForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense" as const, color: "#ef4444", icon: "tag" }
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense" as const, color: "#ef4444", icon: "tag" }
  });

  // El color/nombre de categoría se lee en vivo desde otras queries (spending-by-category,
  // dashboard summary) — invalidar solo la lista de categorías dejaba esas pantallas
  // con el dato viejo aunque Categories ya mostrara el cambio.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
  };

  const openCreate = (type: "expense" | "income") => {
    createForm.reset({
      name: "",
      type,
      color: type === "income" ? INCOME_COLORS[1] : EXPENSE_COLORS[3],
      icon: "tag",
    });
    setIsCreateOpen(true);
  };

  const onCreateSubmit = (data: CategoryFormValues) => {
    createCategory.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Category created" });
        invalidate();
        setIsCreateOpen(false);
        createForm.reset({ name: "", type: "expense", color: "#ef4444", icon: "tag" });
      },
      onError: () => toast({ title: "Failed to create category", variant: "destructive" })
    });
  };

  const openEdit = (cat: { id: number; name: string; type: string; color: string; icon: string | null }) => {
    editForm.reset({
      name: cat.name,
      type: cat.type as "income" | "expense" | "both",
      color: cat.color,
      icon: cat.icon ?? "tag",
    });
    setEditingId(cat.id);
  };

  const onEditSubmit = (data: CategoryFormValues) => {
    if (editingId == null) return;
    updateCategory.mutate({ id: editingId, data }, {
      onSuccess: () => {
        toast({ title: "Category updated" });
        invalidate();
        setEditingId(null);
      },
      onError: () => toast({ title: "Failed to update category", variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    deleteCategory.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Category deleted" });
        invalidate();
      },
      onError: () => toast({ title: "Cannot delete — category is in use.", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-title text-3xl pr-14 min-h-10 flex items-center">Categories</h2>
        </div>

        <Button className="gap-2 w-full sm:w-auto bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0" onClick={() => openCreate("expense")}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create modal */}
      <FloatingModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Category">
        <CategoryForm
          form={createForm}
          onSubmit={onCreateSubmit}
          isPending={createCategory.isPending}
          onCancel={() => setIsCreateOpen(false)}
          submitLabel="Create"
        />
      </FloatingModal>

      {/* Edit modal */}
      <FloatingModal open={editingId !== null} onClose={() => setEditingId(null)} title="Edit Category">
        <CategoryForm
          form={editForm}
          onSubmit={onEditSubmit}
          isPending={updateCategory.isPending}
          onCancel={() => setEditingId(null)}
          submitLabel="Save"
          onDelete={() => {
            if (editingId != null) handleDelete(editingId);
            setEditingId(null);
          }}
        />
      </FloatingModal>

      {/* Nubes de pills — cada categoria es un sticker de su color */}
      {isLoading ? (
        <div className="flex flex-wrap gap-1.5">
          {[90, 64, 110, 72, 96, 60, 84].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-xl" style={{ width: w }} />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {(["expense", "income"] as const).map((type) => {
            // "both" también entra acá — si no, una categoría con ese type queda
            // invisible en las dos secciones (ni "expense" ni "income" calzan
            // estricto) aunque siga apareciendo en otros filtros de la app que sí
            // la contemplan (ej. el filtro de Transactions).
            const filtered = (Array.isArray(categories) ? categories : []).filter(c => c.type === type || c.type === "both");
            const sectionColor = type === "expense" ? "#FF3B3B" : "#1DB954";
            const sectionLabel = type === "expense" ? "Expenses" : "Income";
            return (
              <div key={type}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectionColor }} />
                  <p className="text-xs font-bold uppercase tracking-widest text-foreground">{sectionLabel}</p>
                  <span className="text-xs text-muted-foreground">({filtered.length})</span>
                </div>

                {/* Swatches Pantone — acciones glass sobre el color, base solo nombre */}
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-2xl overflow-hidden bg-card flex flex-col"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                    >
                      {/* Bloque de color con acciones integradas */}
                      <div
                        onClick={() => openEdit(cat)}
                        className="relative w-full h-9 shrink-0 cursor-pointer"
                        style={{ backgroundColor: cat.color }}
                      >
                        <div
                          className="absolute -top-5 -left-3 w-14 h-14 rounded-full pointer-events-none"
                          style={{ background: "rgba(255,255,255,0.28)" }}
                        />
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                            className="h-6 w-6 flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                            style={{ background: "rgba(0,0,0,0.18)" }}
                          >
                            <Pencil className="h-3 w-3 text-white" />
                          </button>
                          <ConfirmDialog
                            trigger={
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="h-6 w-6 flex items-center justify-center rounded-lg active:scale-90 transition-transform"
                                style={{ background: "rgba(0,0,0,0.18)" }}
                              >
                                <Trash2 className="h-3 w-3 text-white" />
                              </button>
                            }
                            icon={Trash2}
                            title="Delete Category"
                            description={`Delete "${cat.name}"? This cannot be undone, and will fail if any transactions use this category.`}
                            confirmLabel="Delete"
                            onConfirm={() => handleDelete(cat.id)}
                          />
                        </div>
                      </div>
                      {/* Base — solo el nombre, limpio */}
                      <div className="px-3 py-2 flex items-center">
                        <p className="text-sm font-bold text-foreground leading-snug">{cat.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
