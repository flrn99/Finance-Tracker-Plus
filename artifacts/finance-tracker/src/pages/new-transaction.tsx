import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateTransaction,
  useListCategories,
  getListCategoriesQueryKey,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FolderPlus, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import CurrencyInput from "@/components/currency-input";
import MonthSelect from "@/components/month-select";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().min(2, "Description is required"),
  date: z.string().min(1, "Date is required"),
  categoryId: z.coerce.number().min(1, "Category is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTransaction() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() }
  });

  const createTx = useCreateTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      description: "",
      date: new Date().toISOString().slice(0, 7),
      categoryId: undefined,
      notes: "",
    },
  });

  const type = form.watch("type");
  const isIncome = type === "income";
  const filteredCategories = Array.isArray(categories)
    ? categories.filter((c) => c.type === type || c.type === "both")
    : [];

  const onSubmit = (data: FormValues) => {
    const fullDate = data.date.length === 7 ? `${data.date}-01` : data.date;
    createTx.mutate(
      { data: { ...data, date: fullDate } },
      {
        onSuccess: () => {
          toast({ title: "Transaction added successfully" });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 3 }) });
          setLocation("/transactions");
        },
        onError: () => {
          toast({ title: "Failed to add transaction", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-muted shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h2 className="text-xl font-bold">New Transaction</h2>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          {/* Type toggle — liquid glass slider */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormControl>
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
                      onClick={() => { field.onChange("expense"); form.setValue("categoryId", undefined as any); }}
                      className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors duration-300 rounded-full", !isIncome ? "text-white" : "text-foreground/50")}
                    >
                      <TrendingDown className="h-4 w-4" />Expense
                    </button>
                    <button
                      type="button"
                      onClick={() => { field.onChange("income"); form.setValue("categoryId", undefined as any); }}
                      className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors duration-300 rounded-full", isIncome ? "text-white" : "text-foreground/50")}
                    >
                      <TrendingUp className="h-4 w-4" />Income
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="0.00"
                      className="text-base font-semibold bg-card rounded-2xl h-12 shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MonthSelect
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      variant={type}
                      size="lg"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="What was this for?"
                    className="bg-card rounded-2xl h-12 shadow-sm"
                    {...field}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value?.toString() ?? ""}>
                  <FormControl>
                    <SelectTrigger className="bg-card rounded-2xl h-12 shadow-sm">
                      <SelectValue placeholder="Select category...">
                        {field.value && Array.isArray(categories) && (() => {
                          const cat = categories.find(c => c.id === field.value);
                          if (!cat) return "Select category...";
                          return (
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </div>
                          );
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCategories.length === 0 ? (
                      <div className="py-2 px-1">
                        <Link href="/categories" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="w-full flex items-center gap-2 px-2 py-2 rounded-2xl text-sm text-primary hover:bg-primary/10 transition-colors">
                            <FolderPlus className="h-4 w-4 shrink-0" />
                            Add a category
                          </button>
                        </Link>
                      </div>
                    ) : (
                      filteredCategories.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Notes (optional)"
                    className="resize-none bg-card rounded-2xl shadow-sm"
                    rows={2}
                    {...field}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={createTx.isPending}
              className="flex-1 py-3.5 rounded-2xl bg-black text-white text-sm font-bold border-0 disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {createTx.isPending ? "Saving..." : "Save Transaction"}
            </button>
            <Link href="/transactions">
              <button type="button" className="px-6 py-3.5 rounded-2xl bg-muted text-foreground text-sm font-semibold border-0">
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
