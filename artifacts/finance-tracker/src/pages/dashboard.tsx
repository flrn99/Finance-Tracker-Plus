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

export default function Dashboard() {
  const { formatAmount } = useCurrency();

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    {},
    { query: { queryKey: getGetDashboardSummaryQueryKey({}) } }
  );

  const { data: spending, isLoading: isLoadingSpending } = useGetSpendingByCategory(
    {},
    { query: { queryKey: getGetSpendingByCategoryQueryKey({}) } }
  );

  const { data: topExpenses, isLoading: isLoadingTopExpenses } = useGetTopExpenses(
    { limit: 5 },
    { query: { queryKey: getGetTopExpensesQueryKey({ limit: 5 }) } }
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1 text-sm">A summary of your financial health.</p>
      </div>

      {/* New Entry */}
      <QuickEntry />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-violet-500 to-purple-700 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Total Balance</CardTitle>
            <div className="p-1.5 rounded-full bg-white/20"><Wallet className="h-4 w-4 text-white" /></div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-[120px] bg-white/20" /> : (
              <div className="text-2xl sm:text-3xl font-bold font-sans truncate">{formatAmount(summary?.balance || 0)}</div>
            )}
            <p className="text-xs text-white/60 mt-1">Across all accounts</p>
          </CardContent>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-emerald-400 to-teal-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Total Income</CardTitle>
            <div className="p-1.5 rounded-full bg-white/20"><ArrowUpIcon className="h-4 w-4 text-white" /></div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-[120px] bg-white/20" /> : (
              <div className="text-2xl sm:text-3xl font-bold font-sans truncate">{formatAmount(summary?.totalIncome || 0)}</div>
            )}
            <p className="text-xs text-white/60 mt-1">This month</p>
          </CardContent>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-md bg-gradient-to-br from-rose-400 to-red-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-white/80">Total Expenses</CardTitle>
            <div className="p-1.5 rounded-full bg-white/20"><ArrowDownIcon className="h-4 w-4 text-white" /></div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-[120px] bg-white/20" /> : (
              <div className="text-2xl sm:text-3xl font-bold font-sans truncate">{formatAmount(summary?.totalExpenses || 0)}</div>
            )}
            <p className="text-xs text-white/60 mt-1">This month</p>
          </CardContent>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
        </Card>
      </div>

      {/* Top Expenses first, then Spending by Category */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
        {/* Top Expenses */}
        <Card className="lg:col-span-3 border border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Expenses</CardTitle>
            <CardDescription className="text-xs">Your largest transactions this month</CardDescription>
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
                <p>No expenses found for this month.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="lg:col-span-2 border border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <CardDescription className="text-xs">Where your money goes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSpending ? (
              <div className="flex justify-center items-center h-[260px]">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              </div>
            ) : spending && spending.length > 0 ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={spending} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="total">
                      {spending.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.categoryColor} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(value: number) => formatAmount(value)}
                    />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
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
