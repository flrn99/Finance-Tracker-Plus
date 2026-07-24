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
  CategoryForm,
  CreateCategoryModal,
  CATEGORY_ICONS,
} from "@/components/category-form-modal";
import { FloatingModal } from "@/components/floating-modal";

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
      // El form no tiene forma de representar "both" (no existe esa opción en
      // el picker) — si la categoría es "both", precargamos "expense" como
      // default razonable en vez de romper el tipo del form.
      type: cat.type === "both" ? "expense" : (cat.type as "income" | "expense"),
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

        <Button
          className="gap-2 w-full sm:w-auto text-black border-0 font-bold"
          style={{
            background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
          }}
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create modal */}
      <CreateCategoryModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} defaultType="expense" />

      {/* Edit modal */}
      <FloatingModal open={editingId !== null} onClose={() => setEditingId(null)} title="Edit Category" maxWidth="max-w-xs" headerPaddingTop="pt-4">
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

      {/* Filas tintadas — misma DNA que las cards de Goals/Savings (tinte 8%
          del color + ícono en cuadrado con tinte 15%), ya vivas y aprobadas
          en el app. Antes Categories era la única lista sin este tratamiento. */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[60px] rounded-2xl" />
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
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sectionColor }} />
                  <p className="text-xs font-bold uppercase tracking-widest text-foreground">{sectionLabel}</p>
                  <span className="text-xs text-muted-foreground">({filtered.length})</span>
                </div>

                <div className="space-y-1.5">
                  {filtered.map((cat, i) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      index={i}
                      onEdit={() => openEdit(cat)}
                      onDelete={() => handleDelete(cat.id)}
                    />
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

// Colapso real al borrar (mismo patrón que transactions.tsx): en vez de que la
// fila desaparezca de un salto cuando la mutation invalida la query, esto la
// achica (grid-rows a 0fr + fade) apenas se confirma, y recién ahí dispara el
// delete real.
function CategoryRow({
  cat, index, onEdit, onDelete,
}: {
  cat: { id: number; name: string; icon: string | null; color: string };
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const Icon = CATEGORY_ICONS[cat.icon ?? "tag"] ?? CATEGORY_ICONS.tag;

  // Entrada con stagger corto al montar — mismo tope que en Transactions, para
  // que una sección con muchas categorías no tarde demasiado en asentar.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setEntered(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);
  const enterDelay = Math.min(index, 8) * 25;

  return (
    <div
      className="grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ gridTemplateRows: isExiting ? "0fr" : "1fr" }}
    >
      <div className="overflow-hidden">
        <div
          className="rounded-2xl px-3.5 py-3 flex items-center gap-2.5"
          style={{
            // background-color en la transition (no solo opacity): la migración
            // silenciosa de paleta vieja→nueva (ver hasMigratedColors en Categories)
            // cambia cat.color por debajo sin que el usuario haga nada — sin esto
            // el swatch "saltaba" de color de un frame al otro.
            background: `${cat.color}14`,
            opacity: isExiting ? 0 : entered ? 1 : 0,
            transform: entered ? "translateY(0)" : "translateY(6px)",
            transition: isExiting
              ? "opacity 200ms ease"
              : `background-color 300ms ease, opacity 320ms cubic-bezier(0.34,1.56,0.64,1) ${enterDelay}ms, transform 320ms cubic-bezier(0.34,1.56,0.64,1) ${enterDelay}ms`,
          }}
        >
          <button
            onClick={onEdit}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${cat.color}25`, transition: "background-color 300ms ease" }}
            >
              <Icon className="h-4.5 w-4.5" style={{ color: cat.color, transition: "color 300ms ease" }} />
            </div>
            <p className="text-sm font-bold text-foreground truncate">{cat.name}</p>
          </button>
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 active:scale-90 transition-transform shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmDialog
            trigger={
              <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 active:scale-90 transition-transform shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            }
            icon={Trash2}
            title="Delete Category"
            description={`Delete "${cat.name}"? This cannot be undone, and will fail if any transactions use this category.`}
            confirmLabel="Delete"
            onConfirm={() => {
              setIsExiting(true);
              setTimeout(onDelete, 240);
            }}
          />
        </div>
      </div>
    </div>
  );
}
