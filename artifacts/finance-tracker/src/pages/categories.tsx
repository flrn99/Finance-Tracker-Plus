import { useState } from "react";
import {
  useListCategories,
  getListCategoriesQueryKey,
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
import { Plus, Trash2, Tag, Check, Pencil, X, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PRESET_COLORS = [
  "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7",
];

const COLOR_NAMES: Record<string, string> = {
  "#ec4899": "Pink",
  "#ef4444": "Red",
  "#f97316": "Orange",
  "#f59e0b": "Amber",
  "#84cc16": "Lime",
  "#22c55e": "Green",
  "#14b8a6": "Teal",
  "#0ea5e9": "Sky",
  "#6366f1": "Indigo",
  "#a855f7": "Grape",
};

function colorLabel(hex: string): string {
  return COLOR_NAMES[hex.toLowerCase()] ?? hex;
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
  if (!open) return null;
  return (
    <div
      className="fixed z-50 flex items-center justify-center px-5"
      style={{
        top: 0, left: 0, right: 0, bottom: 0,
        height: '100dvh',
        width: '100vw',
      }}
      onClick={onClose}
    >
      <div
        className="bg-black/80 animate-in fade-in-0 duration-200"
        style={{
          position: 'fixed',
          top: '-10vh', left: '-10vw', right: '-10vw', bottom: '-10vh',
          width: '120vw', height: '120dvh',
        }}
      />
      <div
        className="relative w-full max-w-xs bg-card rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
        onClick={e => e.stopPropagation()}
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

function CategoryForm({
  form,
  onSubmit,
  isPending,
  onCancel,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<CategoryFormValues>>;
  onSubmit: (data: CategoryFormValues) => void;
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  const selectedColor = form.watch("color");
  const watchedName = form.watch("name");
  const watchedType = form.watch("type");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

        {/* 🔮 Preview en vivo — asi se vera tu categoria */}
        <div className="rounded-2xl overflow-hidden border border-border">
          <div className="relative w-full h-11" style={{ backgroundColor: selectedColor }}>
            <div className="absolute -top-5 -right-3 w-14 h-14 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.28)" }} />
          </div>
          <div className="px-3 py-2 flex items-center justify-between gap-2 bg-card">
            <p className={cn("text-sm font-bold leading-tight", watchedName ? "text-foreground" : "text-muted-foreground/50")}>
              {watchedName || "Category name"}
            </p>
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

        {/* Name + Type in one row */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Subscriptions" className="rounded-2xl" {...field} />
              </FormControl>
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
                    onClick={() => field.onChange("expense")}
                    className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors duration-300 rounded-full", !isIncome ? "text-white" : "text-foreground/50")}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("income")}
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

        {/* Color — pills tintados en orden tonal */}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <FormControl>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_COLORS.map((color) => {
                    const active = field.value === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => field.onChange(color)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.96]"
                        style={{
                          background: `${color}1F`,
                          color,
                          boxShadow: active ? `inset 0 0 0 1.5px ${color}` : "none",
                        }}
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
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-2xl bg-[#A8FF3E] text-black text-sm font-bold border-0 disabled:opacity-60">
            {isPending ? "Saving..." : submitLabel}
          </button>
        </div>
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

  const createForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense" as const, color: "#a855f7", icon: "tag" }
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense" as const, color: "#a855f7", icon: "tag" }
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const onCreateSubmit = (data: CategoryFormValues) => {
    createCategory.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Category created" });
        invalidate();
        setIsCreateOpen(false);
        createForm.reset({ name: "", type: "expense", color: "#a855f7", icon: "tag" });
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
          <h2 className="text-2xl font-bold tracking-tight pr-14 min-h-10 flex items-center">Categories</h2>
        </div>

        <Button className="gap-2 w-full sm:w-auto bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0" onClick={() => setIsCreateOpen(true)}>
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
        />
      </FloatingModal>

      {/* List — grouped by type */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : !categories?.length ? (
        <div className="bg-card rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Tag className="h-8 w-8 opacity-30" />
          <p className="text-sm">No categories yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(["expense", "income"] as const).map((type) => {
            const filtered = (Array.isArray(categories) ? categories : []).filter(c => c.type === type);
            if (filtered.length === 0) return null;
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

                {/* Cards grid */}
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((cat) => {
                    return (
                      <div
                        key={cat.id}
                        className="rounded-3xl overflow-hidden bg-card"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                      >
                        {/* Chip de color puro — el color es el heroe */}
                        <button
                          onClick={() => openEdit(cat)}
                          className="relative w-full h-12 block active:scale-[0.98] transition-transform"
                          style={{ backgroundColor: cat.color }}
                        >
                          {/* Brillo tipo laca */}
                          <div
                            className="absolute -top-6 -right-4 w-20 h-20 rounded-full pointer-events-none"
                            style={{ background: "rgba(255,255,255,0.28)" }}
                          />
                        </button>

                        {/* Base del swatch */}
                        <div className="px-3 py-2.5 flex items-center justify-between gap-1.5">
                          <p className="min-w-0 flex-1 text-sm font-bold text-foreground leading-tight">{cat.name}</p>
                          <div className="flex items-center shrink-0">
                            <button
                              onClick={() => openEdit(cat)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Delete "{cat.name}"? This cannot be undone, and will fail if any transactions use this category.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(cat.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
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
  );
}
