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
import { Plus, Search, FilterX, Trash2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthPicker({ value, onChange }: { value: { year: number; month: number } | null; onChange: (v: { year: number; month: number } | null) => void }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(value?.year ?? now.getFullYear());
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Month</label>
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <button onClick={() => setViewYear((y) => y - 1)} className="p-1 rounded-md hover:bg-muted transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold">{viewYear}</span>
          <button onClick={() => setViewYear((y) => y + 1)} className="p-1 rounded-md hover:bg-muted transition-colors" disabled={viewYear >= now.getFullYear()}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {MONTHS.map((label, idx) => {
            const isSelected = value?.year === viewYear && value?.month === idx + 1;
            const isFuture = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && idx > now.getMonth());
            return (
              <button
                key={label}
                disabled={isFuture}
                onClick={() => onChange(isSelected ? null : { year: viewYear, month: idx + 1 })}
                className={cn(
                  "text-[11px] rounded-lg py-1.5 font-semibold transition-all",
                  isSelected ? "bg-primary text-primary-foreground shadow-sm" : isFuture ? "text-muted-foreground/30 cursor-not-allowed" : "hover:bg-muted text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {value && (
          <div className="px-2 pb-2">
            <button onClick={() => onChange(null)} className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1 rounded-md border border-dashed border-border hover:border-foreground/30 transition-colors">
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrency();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<{ year: number; month: number } | null>(null);

  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  const queryParams = {
    ...(filterType !== "all" && { type: filterType as "income" | "expense" }),
    ...(filterCategory !== "all" && { categoryId: parseInt(filterCategory) }),
  };

  const { data: transactions, isLoading } = useListTransactions(queryParams, {
    query: { queryKey: getListTransactionsQueryKey(queryParams) },
  });

  const filteredTransactions = filterMonth
    ? transactions?.filter((tx) => {
        const d = new Date(tx.date);
        return d.getFullYear() === filterMonth.year && d.getMonth() + 1 === filterMonth.month;
      })
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

  const hasFilters = filterType !== "all" || filterCategory !== "all" || filterMonth !== null;
  const resetFilters = () => { setFilterType("all"); setFilterCategory("all"); setFilterMonth(null); };

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
          <div className="space-y-1 w-32 shrink-0">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
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

          <div className="space-y-1 flex-1 min-w-[140px]">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger data-testid="select-filter-category" className="h-8 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-48 shrink-0">
            <MonthPicker value={filterMonth} onChange={setFilterMonth} />
          </div>

          {hasFilters && (
            <div className="flex items-end self-end pb-0.5">
              <Button variant="outline" size="icon" onClick={resetFilters} title="Reset filters" data-testid="button-reset-filters" className="h-8 w-8">
                <FilterX className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Monthly summary strip */}
        {filterMonth && monthlyTotal && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-income/10 rounded-xl p-3 text-center">
              <p className="text-[10px] font-semibold text-income/70 uppercase tracking-wide mb-0.5">Income</p>
              <p className="text-sm font-bold text-income truncate">{formatAmount(monthlyTotal.income)}</p>
            </div>
            <div className="bg-expense/10 rounded-xl p-3 text-center">
              <p className="text-[10px] font-semibold text-expense/70 uppercase tracking-wide mb-0.5">Expenses</p>
              <p className="text-sm font-bold text-expense truncate">{formatAmount(monthlyTotal.expense)}</p>
            </div>
            <div className={cn("rounded-xl p-3 text-center", monthlyTotal.income - monthlyTotal.expense >= 0 ? "bg-income/10" : "bg-expense/10")}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Balance</p>
              <p className={cn("text-sm font-bold truncate", monthlyTotal.income - monthlyTotal.expense >= 0 ? "text-income" : "text-expense")}>
                {formatAmount(monthlyTotal.income - monthlyTotal.expense)}
              </p>
            </div>
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
