import { useEffect, useRef, useState } from "react";
import {
  useListCategories,
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  useUpdateCategory,
  useDeleteCategory
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EXPENSE_COLORS,
  INCOME_COLORS,
  nearestPaletteColor,
  categorySchema,
  type CategoryFormValues,
  FloatingModal,
  CategoryForm,
  CreateCategoryModal,
} from "@/components/category-form-modal";

export default function Categories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: categories, isLoading } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() }
  });

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

        <Button className="gap-2 w-full sm:w-auto bg-[#CAFA01] text-black hover:bg-[#9bfe32] border-0 font-bold" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create modal */}
      <CreateCategoryModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} defaultType="expense" />

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
