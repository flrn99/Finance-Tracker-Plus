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
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#64748b", "#0f172a", "#7c3aed",
];

const COLOR_NAMES: Record<string, string> = {
  "#ef4444": "Cherry Bomb",
  "#f97316": "Tangerine Dream",
  "#f59e0b": "Golden Hour",
  "#eab308": "Lemon Zest",
  "#84cc16": "Electric Lime",
  "#22c55e": "Jungle Green",
  "#10b981": "Mint Condition",
  "#14b8a6": "Tropical Teal",
  "#06b6d4": "Cyber Cyan",
  "#0ea5e9": "Sky High",
  "#3b82f6": "Cobalt Blast",
  "#6366f1": "Cosmic Indigo",
  "#8b5cf6": "Ultraviolet",
  "#a855f7": "Grape Soda",
  "#d946ef": "Neon Orchid",
  "#ec4899": "Bubblegum Pop",
  "#f43f5e": "Wild Rose",
  "#64748b": "Storm Cloud",
  "#0f172a": "Midnight Void",
  "#7c3aed": "Royal Velvet",
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
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

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

        {/* Color — compact swatch picker */}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Color</FormLabel>
              <FormControl>
                <div>
                  <button
                    type="button"
                    onClick={() => setColorOpen(o => !o)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-2xl bg-muted border-0 text-sm font-medium"
                  >
                    <span className="w-5 h-5 rounded-full shrink-0 border-2 border-white shadow" style={{ backgroundColor: selectedColor }} />
                    <span className="flex-1 text-left text-foreground">{colorLabel(selectedColor)}</span>
                    <span className="text-muted-foreground text-xs">{colorOpen ? "▲" : "▼"}</span>
                  </button>
                  {colorOpen && (
                    <div className="mt-2 p-3 bg-muted rounded-2xl">
                      <div className="grid grid-cols-10 gap-1.5">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => { field.onChange(color); setColorOpen(false); }}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-90 focus:outline-none"
                            style={{ backgroundColor: color }}
                          >
                            {selectedColor === color && <Check className="h-3 w-3 text-white drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
    defaultValues: { name: "", type: "expense" as const, color: "#8b5cf6", icon: "tag" }
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense" as const, color: "#8b5cf6", icon: "tag" }
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const onCreateSubmit = (data: CategoryFormValues) => {
    createCategory.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Category created" });
        invalidate();
        setIsCreateOpen(false);
        createForm.reset({ name: "", type: "expense", color: "#8b5cf6", icon: "tag" });
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
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
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
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
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
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: sectionColor }}>{sectionLabel}</p>
                  <span className="text-xs text-muted-foreground">({filtered.length})</span>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((cat) => (
                    <div
                      key={cat.id}
                      className="bg-card rounded-2xl shadow-sm p-3 flex flex-col gap-2"
                    >
                      {/* Top row: color bubble + actions */}
                      <div className="flex items-start justify-between">
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.color}20` }}
                        >
                          <Tag className="h-4 w-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => openEdit(cat)}
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

                      {/* Name */}
                      <p className="text-sm font-bold text-foreground leading-tight truncate">{cat.name}</p>

                      {/* Color accent bar */}
                      <div className="h-1 rounded-full" style={{ backgroundColor: cat.color }} />
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
