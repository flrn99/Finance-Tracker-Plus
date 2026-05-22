import { useState } from "react";
import {
  useListCategories,
  getListCategoriesQueryKey,
  useCreateCategory,
  useDeleteCategory
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Tag, Check } from "lucide-react";
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

export default function Categories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: categories, isLoading } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() }
  });

  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense", color: "#8b5cf6", icon: "tag" }
  });

  const selectedColor = form.watch("color");

  const onSubmit = (data: CategoryFormValues) => {
    createCategory.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Category created" });
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setIsDialogOpen(false);
        form.reset({ name: "", type: "expense", color: "#8b5cf6", icon: "tag" });
      },
      onError: () => toast({ title: "Failed to create category", variant: "destructive" })
    });
  };

  const handleDelete = (id: number) => {
    deleteCategory.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Category deleted" });
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete. It might be in use.", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground mt-1 text-sm">Manage tags for your transactions.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm w-full">
            <DialogHeader>
              <DialogTitle>Add Category</DialogTitle>
              <DialogDescription>Create a new category to organize your spending.</DialogDescription>
            </DialogHeader>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          {/* Preset color swatches */}
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
                          {/* Preview + hex input */}
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full shrink-0 border border-border shadow-sm"
                              style={{ backgroundColor: field.value }}
                            />
                            <Input
                              type="text"
                              value={field.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val);
                              }}
                              placeholder="#8b5cf6"
                              className="flex-1 font-mono text-sm h-8"
                              maxLength={7}
                            />
                            <input
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-transparent shrink-0"
                              title="Pick a custom color"
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
                  <Button type="submit" disabled={createCategory.isPending} className="flex-1 sm:flex-none">
                    {createCategory.isPending ? "Saving..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))
        ) : (
          categories?.map(category => (
            <div
              key={category.id}
              className="group relative bg-card border border-card-border rounded-2xl p-4 flex flex-col items-center gap-3 text-center hover:shadow-md transition-all"
            >
              {/* Color circle */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm mt-1"
                style={{ backgroundColor: `${category.color}22` }}
              >
                <Tag className="h-6 w-6" style={{ color: category.color }} />
              </div>

              {/* Labels */}
              <div className="space-y-0.5 w-full">
                <h3 className="font-semibold text-sm leading-tight truncate">{category.name}</h3>
                <span
                  className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{ backgroundColor: `${category.color}22`, color: category.color }}
                >
                  {category.type}
                </span>
              </div>

              {/* Delete — appears on hover */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                    <AlertDialogDescription>
                      Delete "{category.name}"? This will fail if transactions use it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(category.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
