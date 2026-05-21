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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FilterX, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthPicker({ value, onChange }: { value: { year: number; month: number } | null; onChange: (v: { year: number; month: number } | null) => void }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(value?.year ?? now.getFullYear());

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Month</label>
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        {/* Year nav */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
          <button
            onClick={() => setViewYear((y) => y - 1)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{viewYear}</span>
          <button
            onClick={() => setViewYear((y) => y + 1)}
            className="p-1 rounded hover:bg-muted transition-colors"
            disabled={viewYear >= now.getFullYear()}
          >
            <ChevronRight className="h-4 w-4 disabled:opacity-30" />
          </button>
        </div>
        {/* Month grid */}
        <div className="grid grid-cols-4 gap-1 p-2">
          {MONTHS.map((label, idx) => {
            const isSelected = value?.year === viewYear && value?.month === idx + 1;
            const isFuture = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && idx > now.getMonth());
            return (
              <button
                key={label}
                disabled={isFuture}
                onClick={() => {
                  if (isSelected) {
                    onChange(null);
                  } else {
                    onChange({ year: viewYear, month: idx + 1 });
                  }
                }}
                className={`text-xs rounded-md py-1.5 font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isFuture
                    ? "text-muted-foreground/30 cursor-not-allowed"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {value && (
          <div className="px-2 pb-2">
            <button
              onClick={() => onChange(null)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 rounded border border-dashed border-border hover:border-foreground/30 transition-colors"
            >
              Clear month filter
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

  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });

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
    deleteTx.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Transaction deleted" });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to delete transaction", variant: "destructive" });
        },
      }
    );
  };

  const hasFilters = filterType !== "all" || filterCategory !== "all" || filterMonth !== null;
  const resetFilters = () => {
    setFilterType("all");
    setFilterCategory("all");
    setFilterMonth(null);
  };

  const monthlyTotal = filteredTransactions?.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.income += tx.amount;
      else acc.expense += tx.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold tracking-tight text-foreground">Transactions</h2>
          <p className="text-muted-foreground mt-1">View and manage your financial records.</p>
        </div>
        <Link href="/transactions/new" className="inline-flex">
          <Button className="w-full sm:w-auto gap-2" data-testid="button-add-transaction">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-lg border border-card-border shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-start mb-6">
          {/* Type filter */}
          <div className="space-y-1.5 w-36 shrink-0">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger data-testid="select-filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Month picker */}
          <div className="w-52 shrink-0">
            <MonthPicker value={filterMonth} onChange={setFilterMonth} />
          </div>

          {hasFilters && (
            <div className="flex items-end pb-0.5">
              <Button variant="outline" size="icon" onClick={resetFilters} title="Reset all filters" data-testid="button-reset-filters">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Monthly totals when a month is selected */}
        {filterMonth && monthlyTotal && (
          <div className="flex gap-4 mb-4 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Income</p>
              <p className="text-base font-bold text-income">{formatAmount(monthlyTotal.income)}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
              <p className="text-base font-bold text-expense">{formatAmount(monthlyTotal.expense)}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Balance</p>
              <p className={`text-base font-bold ${monthlyTotal.income - monthlyTotal.expense >= 0 ? "text-income" : "text-expense"}`}>
                {formatAmount(monthlyTotal.income - monthlyTotal.expense)}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTransactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Search className="h-8 w-8 mb-2 opacity-50" />
                      <p>No transactions found.</p>
                      <p className="text-sm">Try adjusting your filters or adding a new one.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions?.map((tx, idx) => (
                  <TableRow
                    key={tx.id}
                    data-testid={`row-transaction-${tx.id}`}
                    className="group animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">{formatDate(tx.date)}</TableCell>
                    <TableCell className="font-medium">{tx.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: tx.categoryColor,
                          color: tx.categoryColor,
                          backgroundColor: `${tx.categoryColor}18`,
                        }}
                      >
                        {tx.categoryName}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${tx.type === "income" ? "text-income" : "text-expense"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatAmount(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              data-testid={`button-delete-transaction-${tx.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
