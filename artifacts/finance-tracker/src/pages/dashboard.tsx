import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useGetSpendingByCategory, getGetSpendingByCategoryQueryKey, useGetMonthlyTrend, getGetMonthlyTrendQueryKey, useGetTopExpenses, getGetTopExpensesQueryKey } from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { ArrowDownIcon, ArrowUpIcon, Wallet, Activity } from "lucide-react";
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

  const { data: trend, isLoading: isLoadingTrend } = useGetMonthlyTrend(
    { query: { queryKey: getGetMonthlyTrendQueryKey() } }
  );

  const { data: topExpenses, isLoading: isLoadingTopExpenses } = useGetTopExpenses(
    { limit: 5 },
    { query: { queryKey: getGetTopExpensesQueryKey({ limit: 5 }) } }
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-serif font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">A summary of your financial health.</p>
      </div>

      {/* Quick Entry */}
      <QuickEntry />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div className="text-3xl font-bold font-sans">
                {formatAmount(summary?.balance || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across all accounts</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            <div className="p-1 rounded-full bg-income/10">
              <ArrowUpIcon className="h-4 w-4 text-income" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div className="text-3xl font-bold font-sans text-income">
                {formatAmount(summary?.totalIncome || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <div className="p-1 rounded-full bg-expense/10">
              <ArrowDownIcon className="h-4 w-4 text-expense" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-[120px]" />
            ) : (
              <div className="text-3xl font-bold font-sans text-expense">
                {formatAmount(summary?.totalExpenses || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Monthly Trend Chart */}
        <Card className="md:col-span-1 lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Income vs Expenses
            </CardTitle>
            <CardDescription>Your cash flow over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTrend ? (
              <div className="flex justify-center items-center h-[300px]">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : trend && trend.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => formatAmount(val)} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number) => formatAmount(value)}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                    <Bar dataKey="income" name="Income" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <p>No trend data available yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="md:col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSpending ? (
              <div className="flex justify-center items-center h-[300px]">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              </div>
            ) : spending && spending.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spending}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="total"
                    >
                      {spending.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.categoryColor} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number) => formatAmount(value)}
                    />
                    <Legend
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <p>No spending data available yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Top Expenses</CardTitle>
          <CardDescription>Your largest transactions this month</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTopExpenses ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : topExpenses && topExpenses.length > 0 ? (
            <div className="space-y-5">
              {topExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs shadow-sm"
                      style={{ backgroundColor: expense.categoryColor }}
                    >
                      {expense.categoryName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none mb-1 group-hover:text-primary transition-colors">
                        {expense.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expense.categoryName} • {formatDate(expense.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-expense">
                    -{formatAmount(expense.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p>No expenses found for this month.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
