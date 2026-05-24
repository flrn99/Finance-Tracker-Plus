import { useState, useMemo } from "react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetSpendingByCategory, getGetSpendingByCategoryQueryKey,
  useGetTopExpenses, getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ArrowDownIcon, ArrowUpIcon, Wallet } from "lucide-react";
import QuickEntry from "@/components/quick-entry";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

function todayYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmtYM(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type FilterMode = "month" | "all";

export default function Dashboard() {
  const { formatAmount } = useCurrency();
  const [filterMode, setFilterMode] = useState<FilterMode>("month");

  const currentMonth = todayYM();

  const apiParams = useMemo(() => {
    if (filterMode === "all") return { allTime: true };
    return { month: currentMonth };
  }, [filterMode, currentMonth]);

  const periodLabel = filterMode === "all" ? "Across all time" : fmtYM(currentMonth);

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    apiParams,
    { query: { queryKey: getGetDashboardSummaryQueryKey(apiParams) } }
  );

  const { data: spending, isLoading: isLoadingSpending } = useGetSpendingByCategory(
    apiParams,
    { query: { queryKey: getGetSpendingByCategoryQueryKey(apiParams) } }
  );

  const { data: topExpenses, isLoading: isLoadingTopExpenses } = useGetTopExpenses(
    { ...apiParams, limit: 5 },
    { query: { queryKey: getGetTopExpensesQueryKey({ ...apiParams, limit: 5 }) } }
  );

  const modes: { key: FilterMode; label: string }[] = [
    { key: "month", label: "This Month" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1 text-sm">A summary of your financial health.</p>
      </div>

      <QuickEntry />

      {/* Period toggle — full width matching cards grid */}
      <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl w-full border border-border/50">
        {modes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterMode(key)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap text-center",
              filterMode === key
                ? "bg-background shadow-sm text-foreground border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary Cards — order: Expenses, Income, Balance */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {/* Expenses */}
        <Card className="relative overflow-hidden border border-rose-200/60 dark:border-rose-500/15 shadow-sm bg-rose-50/70 dark:bg-rose-950/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-rose-500 dark:text-rose-400">Total Expenses</CardTitle>
            <div className="p-1.5 rounded-full bg-rose-100 dark:bg-rose-500/15"><ArrowDownIcon className="h-4 w-4 text-rose-500 dark:text-rose-400" /></div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
              <div className="text-2xl sm:text-3xl font-bold font-sans truncate text-rose-600 dark:text-rose-300">{formatAmount(summary?.totalExpenses || 0)}</div>
            )}
            <p className="text-xs text-rose-400 dark:text-rose-500/80 mt-1">{periodLabel}</p>
          </CardContent>
          <div className="absolute -bottom-5 -right-5 w-24 h-24 rounded-full bg-rose-100/50 dark:bg-rose-500/8 pointer-events-none" />
        </Card>

        {/* Income */}
        <Card className="relative overflow-hidden border border-emerald-200/60 dark:border-emerald-500/15 shadow-sm bg-emerald-50/70 dark:bg-emerald-950/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Total Income</CardTitle>
            <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15"><ArrowUpIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
              <div className="text-2xl sm:text-3xl font-bold font-sans truncate text-emerald-700 dark:text-emerald-300">{formatAmount(summary?.totalIncome || 0)}</div>
            )}
            <p className="text-xs text-emerald-400 dark:text-emerald-500/80 mt-1">{periodLabel}</p>
          </CardContent>
          <div className="absolute -bottom-5 -right-5 w-24 h-24 rounded-full bg-emerald-100/50 dark:bg-emerald-500/8 pointer-events-none" />
        </Card>

        {/* Balance */}
        <Card className="relative overflow-hidden border border-violet-200/60 dark:border-violet-500/15 shadow-sm bg-violet-50/70 dark:bg-violet-950/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-violet-500 dark:text-violet-400">Total Balance</CardTitle>
            <div className="p-1.5 rounded-full bg-violet-100 dark:bg-violet-500/15"><Wallet className="h-4 w-4 text-violet-500 dark:text-violet-400" /></div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
              <div className="text-2xl sm:text-3xl font-bold font-sans truncate text-violet-700 dark:text-violet-300">{formatAmount(summary?.balance || 0)}</div>
            )}
            <p className="text-xs text-violet-400 dark:text-violet-500/80 mt-1">{periodLabel}</p>
          </CardContent>
          <div className="absolute -bottom-5 -right-5 w-24 h-24 rounded-full bg-violet-100/50 dark:bg-violet-500/8 pointer-events-none" />
        </Card>
      </div>

      {/* Top Expenses + Spending by Category */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
        <Card className="lg:col-span-3 border border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Expenses</CardTitle>
            <CardDescription className="text-xs">{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTopExpenses ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                      <div><Skeleton className="h-4 w-32 mb-1.5" /><Skeleton className="h-3 w-20" /></div>
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : topExpenses && topExpenses.length > 0 ? (
              <div className="space-y-4">
                {topExpenses.map((expense, idx) => (
                  <div key={expense.id} className="flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0"
                        style={{ backgroundColor: expense.categoryColor }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-none mb-1 truncate group-hover:text-primary transition-colors">
                          {expense.description}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {expense.categoryName} · {formatDate(expense.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-expense shrink-0">
                      -{formatAmount(expense.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                <p>No expenses found for this period.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <CardDescription className="text-xs">{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSpending ? (
              <div className="flex justify-center items-center h-[260px]">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              </div>
            ) : spending && spending.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={spending} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="total">
                        {spending.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.categoryColor} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number) => formatAmount(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {spending.map((entry) => (
                    <div key={entry.categoryId} className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.categoryColor }}
                      />
                      <span className="text-xs text-foreground truncate font-medium">{entry.categoryName}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">{entry.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground text-sm">
                <p>No spending data yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
