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
import { ResponsiveModal } from "@/components/responsive-modal";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Tag, Check, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#64748b", "#0f172a", "#7c3aed",
];

const categorySchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(["income", "expense", "both"]),
  color: z.string().regex(/^#/, "Must be a valid hex color"),
  icon: z.string()
});

type CategoryFormValues = z.infer<typeof categorySchema>;

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  both: "Both",
};

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Subscriptions" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  <div className="grid grid-cols-10 gap-1.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 focus:outline-none",
                          selectedColor === color ? "border-white scale-110 shadow-md ring-2 ring-offset-1 ring-primary" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {selectedColor === color && (
                          <Check className="h-3 w-3 text-white mx-auto drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="pt-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">Cancel</Button>
          <Button type="submit" disabled={isPending} className="flex-1 sm:flex-none">
            {isPending ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
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
    defaultValues: { name: "", type: "expense", color: "#8b5cf6", icon: "tag" }
  });

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense", color: "#8b5cf6", icon: "tag" }
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground mt-1 text-sm">Manage tags for your transactions.</p>
        </div>

        <Button className="gap-2 w-full sm:w-auto" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create modal */}
      <ResponsiveModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Add Category"
        description="Create a new category to organize your spending."
      >
        <CategoryForm
          form={createForm}
          onSubmit={onCreateSubmit}
          isPending={createCategory.isPending}
          onCancel={() => setIsCreateOpen(false)}
          submitLabel="Create"
        />
      </ResponsiveModal>

      {/* Edit modal */}
      <ResponsiveModal
        open={editingId !== null}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        title="Edit Category"
        description="Update the category name, type, or color."
      >
        <CategoryForm
          form={editForm}
          onSubmit={onEditSubmit}
          isPending={updateCategory.isPending}
          onCancel={() => setEditingId(null)}
          submitLabel="Save"
        />
      </ResponsiveModal>

      {/* List */}
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : !categories?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Tag className="h-8 w-8 opacity-30" />
            <p className="text-sm">No categories yet. Create one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(Array.isArray(categories) ? categories : []).map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-muted/30 transition-colors group"
              >
                {/* Color bubble */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  <Tag className="h-4 w-4" style={{ color: cat.color }} />
                </div>

                {/* Name */}
                <span className="font-semibold text-sm flex-1 truncate">{cat.name}</span>

                {/* Type pill */}
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize shrink-0 hidden sm:inline-block"
                  style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                >
                  {TYPE_LABELS[cat.type] ?? cat.type}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Edit */}
                  <button
                    onClick={() => openEdit(cat)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
