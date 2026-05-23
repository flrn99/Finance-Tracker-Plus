import { useState } from "react";
import { Link } from "wouter";
import {
  useListTransactions,
  getListTransactionsQueryKey,
  useDeleteTransaction,
  useListCategories,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FilterX, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import MonthSelect from "@/components/month-select";

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrency();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");

  const handleTypeChange = (val: string) => {
    setFilterType(val);
    setFilterCategory("all");
  };

  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  const filteredCategoryOptions = categories?.filter((c) => {
    if (filterType === "all") return true;
    return c.type === filterType || c.type === "both";
  }) ?? [];

  const queryParams = {
    ...(filterType !== "all" && { type: filterType as "income" | "expense" }),
    ...(filterCategory !== "all" && { categoryId: parseInt(filterCategory) }),
  };

  const { data: transactions, isLoading } = useListTransactions(queryParams, {
    query: { queryKey: getListTransactionsQueryKey(queryParams) },
  });

  const filteredTransactions = filterMonth
    ? transactions?.filter((tx) => tx.date.startsWith(filterMonth))
    : transactions;

  const deleteTx = useDeleteTransaction();
  const handleDelete = (id: number) => {
    deleteTx.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Transaction deleted" });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const hasFilters = filterType !== "all" || filterCategory !== "all" || filterMonth !== "";
  const resetFilters = () => { setFilterType("all"); setFilterCategory("all"); setFilterMonth(""); };

  const monthlyTotal = filteredTransactions?.reduce(
    (acc, tx) => { if (tx.type === "income") acc.income += tx.amount; else acc.expense += tx.amount; return acc; },
    { income: 0, expense: 0 }
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">Transactions</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">View and manage your financial records.</p>
        </div>
        <Link href="/transactions/new" className="inline-flex sm:shrink-0">
          <Button className="w-full sm:w-auto gap-2" data-testid="button-add-transaction">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-card-border shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-start">
          {/* Type */}
          <div className="space-y-1 w-36 shrink-0">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
            <Select value={filterType} onValueChange={handleTypeChange}>
              <SelectTrigger data-testid="select-filter-type" className="h-8 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category — always visible */}
          <div className="space-y-1 flex-1 min-w-[140px]">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger data-testid="select-filter-category" className="h-8 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filteredCategoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month */}
          <div className="space-y-1 shrink-0">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Month</label>
            <MonthSelect value={filterMonth} onChange={setFilterMonth} variant="neutral" className="w-56" />
          </div>

          {hasFilters && (
            <div className="flex items-end self-end pb-0.5">
              <Button variant="outline" size="icon" onClick={resetFilters} title="Reset filters" data-testid="button-reset-filters" className="h-8 w-8">
                <FilterX className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Summary strip — shows when month OR type is filtered */}
        {(filterMonth !== "" || filterType !== "all") && monthlyTotal && (
          <div className={cn(
            "grid gap-2",
            filterType === "all" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 max-w-xs"
          )}>
            {(filterType === "all" || filterType === "income") && (
              <div className="bg-income/10 rounded-xl px-4 py-3 flex sm:flex-col items-center sm:items-center justify-between sm:justify-center gap-1">
                <p className="text-[10px] font-semibold text-income/70 uppercase tracking-wide">Income</p>
                <p className="text-sm font-bold text-income">{formatAmount(monthlyTotal.income)}</p>
              </div>
            )}
            {(filterType === "all" || filterType === "expense") && (
              <div className="bg-expense/10 rounded-xl px-4 py-3 flex sm:flex-col items-center sm:items-center justify-between sm:justify-center gap-1">
                <p className="text-[10px] font-semibold text-expense/70 uppercase tracking-wide">Expenses</p>
                <p className="text-sm font-bold text-expense">{formatAmount(monthlyTotal.expense)}</p>
              </div>
            )}
            {filterType === "all" && (
              <div className={cn(
                "rounded-xl px-4 py-3 flex sm:flex-col items-center sm:items-center justify-between sm:justify-center gap-1",
                monthlyTotal.income - monthlyTotal.expense >= 0 ? "bg-income/10" : "bg-expense/10"
              )}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Balance</p>
                <p className={cn("text-sm font-bold", monthlyTotal.income - monthlyTotal.expense >= 0 ? "text-income" : "text-expense")}>
                  {formatAmount(monthlyTotal.income - monthlyTotal.expense)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-card-border p-4 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0" />
            </div>
          ))
        ) : filteredTransactions?.length === 0 ? (
          <div className="bg-card rounded-2xl border border-card-border p-12 flex flex-col items-center justify-center text-muted-foreground">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-semibold">No transactions found</p>
            <p className="text-sm mt-1">Try adjusting your filters or adding a new one.</p>
          </div>
        ) : (
          filteredTransactions?.map((tx, idx) => (
            <div
              key={tx.id}
              data-testid={`row-transaction-${tx.id}`}
              className="group bg-card rounded-2xl border border-card-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 p-4"
              style={{ animationDelay: `${idx * 25}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: `${tx.categoryColor}22`, border: `2px solid ${tx.categoryColor}44` }}
                >
                  {tx.type === "income"
                    ? <TrendingUp className="h-4 w-4" style={{ color: tx.categoryColor }} />
                    : <TrendingDown className="h-4 w-4" style={{ color: tx.categoryColor }} />
                  }
                </div>

                {/* Amount + category row */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-base font-bold shrink-0", tx.type === "income" ? "text-income" : "text-expense")}>
                      {tx.type === "income" ? "+" : "-"}{formatAmount(tx.amount)}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: `${tx.categoryColor}20`, color: tx.categoryColor }}
                    >
                      {tx.categoryName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(tx.date)}</span>
                    <span className="text-muted-foreground/30 text-xs">·</span>
                    <span className="text-xs text-foreground/70 truncate">{tx.description}</span>
                  </div>
                </div>

                {/* Delete */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        data-testid={`button-delete-transaction-${tx.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{tx.description}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(tx.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
