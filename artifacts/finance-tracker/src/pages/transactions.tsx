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
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FilterX, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

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

  const resetFilters = () => {
    setFilterType("all");
    setFilterCategory("all");
  };

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
        <div className="flex flex-wrap gap-4 items-end mb-6">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
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

          <div className="space-y-1.5 flex-1 min-w-[200px]">
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

          {(filterType !== "all" || filterCategory !== "all") && (
            <Button variant="outline" size="icon" onClick={resetFilters} title="Reset filters" data-testid="button-reset-filters">
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px]"></TableHead>
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
              ) : transactions?.length === 0 ? (
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
                transactions?.map((tx, idx) => (
                  <TableRow
                    key={tx.id}
                    data-testid={`row-transaction-${tx.id}`}
                    className="group animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</TableCell>
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
                    <TableCell className={`text-right font-medium ${tx.type === "income" ? "text-income" : "text-foreground"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
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
