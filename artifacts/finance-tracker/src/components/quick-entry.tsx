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
  getGetMonthlyTrendQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Plus, Check, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import { useState } from "react";
import CurrencyInput from "@/components/currency-input";
import MonthSelect from "@/components/month-select";
import { Link } from "wouter";

const schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive("Enter a valid amount"),
  description: z.string().min(1, "Description required"),
  categoryId: z.coerce.number().min(1, "Pick a category"),
  date: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function QuickEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { symbol, formatAmount } = useCurrency();
  const [saved, setSaved] = useState(false);

  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });

  const createTx = useCreateTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      amount: undefined,
      description: "",
      categoryId: undefined,
      date: new Date().toISOString().slice(0, 7),
    },
  });

  const type = form.watch("type");
  const filteredCategories = Array.isArray(categories)
  ? categories.filter((c) => c.type === type || c.type === "both")
  : [];
  const onSubmit = (data: FormValues) => {
    const usdAmount = data.amount;
    const fullDate = data.date.length === 7 ? `${data.date}-01` : data.date;
    createTx.mutate(
      { data: { ...data, amount: usdAmount, date: fullDate } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          form.reset({
            type: data.type,
            amount: undefined,
            description: "",
            categoryId: undefined,
            date: new Date().toISOString().slice(0, 7),
          });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
          toast({ title: `${data.type === "income" ? "Income" : "Expense"} recorded`, description: `${formatAmount(usdAmount)} logged successfully.` });
        },
        onError: () => {
          toast({ title: "Failed to save", variant: "destructive" });
        },
      }
    );
  };

  const isIncome = type === "income";

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-5 transition-colors duration-300",
        isIncome ? "border-income/30 bg-income/5" : "border-expense/30 bg-expense/5"
      )}
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-serif font-semibold text-lg text-foreground shrink-0">New Entry</h3>
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button
            type="button"
            data-testid="toggle-expense"
            onClick={() => {
              form.setValue("type", "expense");
              form.setValue("categoryId", undefined as unknown as number);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-all whitespace-nowrap rounded-md",
              !isIncome
                ? "bg-expense/15 text-expense"
                : "bg-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
            Expense
          </button>
          <button
            type="button"
            data-testid="toggle-income"
            onClick={() => {
              form.setValue("type", "income");
              form.setValue("categoryId", undefined as unknown as number);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-all whitespace-nowrap rounded-md",
              isIncome
                ? "bg-income/15 text-income"
                : "bg-transparent text-muted-foreground hover:bg-muted"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            Income
          </button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {/* Row 1: Amount + Category */}
          <div className="flex gap-3">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="w-36 shrink-0">
                  <FormControl>
                    <CurrencyInput
                      testId="input-quick-amount"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="0.00"
                      className="text-base font-semibold bg-background"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem className="flex-1 min-w-0">
                  <Select
                    onValueChange={(val) => field.onChange(Number(val))}
                    value={field.value?.toString() ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-quick-category" className="bg-background w-full min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-left">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.length === 0 ? (
                        <div className="py-2 px-1">
                          <Link href="/categories" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-primary hover:bg-primary/10 transition-colors"
                            >
                              <FolderPlus className="h-4 w-4 shrink-0" />
                              Add a category
                            </button>
                          </Link>
                        </div>
                      ) : (
                        filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Row 2: Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    data-testid="input-quick-description"
                    placeholder="What was this for?"
                    className="bg-background"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Row 3: Date + Submit */}
          <div className="flex gap-3 items-start">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <MonthSelect
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      variant={type}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              data-testid="button-quick-save"
              disabled={createTx.isPending || saved}
              className={cn(
                "shrink-0 gap-1.5 transition-all h-10 px-5",
                saved
                  ? "bg-income text-income-foreground border-income/60"
                  : isIncome
                  ? "bg-income hover:bg-income/90 text-income-foreground border-income/60"
                  : "bg-expense hover:bg-expense/90 text-expense-foreground border-expense/60"
              )}
            >
              {saved ? (
                <><Check className="h-4 w-4" />Saved</>
              ) : (
                <><Plus className="h-4 w-4" />{createTx.isPending ? "Saving…" : "Add"}</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
