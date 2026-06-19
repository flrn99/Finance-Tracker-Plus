import { useState, useMemo, useRef, useEffect } from "react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetSpendingByCategory, getGetSpendingByCategoryQueryKey,
  useGetTopExpenses, getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposedChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ArrowDownIcon, ArrowUpIcon, Wallet, TrendingDown, TrendingUp } from "lucide-react";
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

const MEDALS = [
  { emoji: "🥇", color: "#FFD700" },
  { emoji: "🥈", color: "#C0C0C0" },
  { emoji: "🥉", color: "#CD7F32" },
];

export default function Dashboard() {
  const { formatAmount } = useCurrency();
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");

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

  const spendingParams = useMemo(() => ({ ...apiParams, type: categoryType }), [apiParams, categoryType]);

  const { data: spending, isLoading: isLoadingSpending } = useGetSpendingByCategory(
    spendingParams,
    { query: { queryKey: getGetSpendingByCategoryQueryKey(spendingParams) } }
  );

  const topExpensesParams = useMemo(() => ({ ...apiParams, limit: 3, type: categoryType }), [apiParams, categoryType]);

  const { data: topItems, isLoading: isLoadingTop } = useGetTopExpenses(
    topExpensesParams,
    { query: { queryKey: getGetTopExpensesQueryKey(topExpensesParams) } }
  );

  const chartRef = useRef<HTMLDivElement>(null);
  const [chartInView, setChartInView] = useState(false);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) setChartInView(true);
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setChartInView(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [spending]);

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>

      {/* ── Quick Entry ───────────────────────────────────────────── */}
      <QuickEntry />

      {/* ── Period toggle ─────────────────────────────────────────── */}
      <div
        className="relative flex items-center p-1 rounded-2xl w-full overflow-hidden"
        style={{
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          background: "hsl(var(--foreground) / 0.06)",
          boxShadow: "inset 0 1px 1px hsl(var(--foreground) / 0.08), inset 0 -1px 1px hsl(var(--background) / 0.2), 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="absolute top-1 left-1 rounded-2xl transition-transform duration-300 ease-out"
          style={{
            bottom: "4px",
            width: "calc(50% - 4px)",
            transform: filterMode === "all" ? "translateX(100%)" : "translateX(0%)",
            backdropFilter: "blur(16px) saturate(1.6)",
            WebkitBackdropFilter: "blur(16px) saturate(1.6)",
            background: "linear-gradient(135deg, hsl(var(--background) / 0.95), hsl(var(--background) / 0.7))",
            boxShadow: "inset 0 1px 1px hsl(var(--foreground) / 0.06), 0 2px 6px rgba(0,0,0,0.12)",
          }}
        />
        {(["month", "all"] as FilterMode[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilterMode(key)}
            className={cn(
              "relative z-10 flex-1 py-2 rounded-2xl text-xs font-semibold transition-colors duration-300 whitespace-nowrap text-center",
              filterMode === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {key === "month" ? "This Month" : "All Time"}
          </button>
        ))}
      </div>

      {/* ── Summary Cards — original glass, intactas ──────────────── */}
      <div className="space-y-3">
        {/* Balance */}
        <div className="relative overflow-hidden rounded-2xl px-5 py-4" style={{
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          background: "linear-gradient(135deg, rgba(124,58,255,0.35), rgba(124,58,255,0.12))",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Wallet className="h-3.5 w-3.5" style={{ color: "rgba(124,58,255,0.7)" }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6D28D9" }}>Total Balance</p>
              </div>
              {isLoadingSummary
                ? <Skeleton className="h-9 w-36" />
                : <p key={`balance-${filterMode}`} className="text-3xl font-bold animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ color: "#7C3AFF" }}>{formatAmount(summary?.balance || 0)}</p>
              }
              <p className="text-xs font-semibold mt-1" style={{ color: "#6D28D9" }}>{periodLabel}</p>
            </div>
            {!isLoadingSummary && summary && summary.totalIncome > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-semibold mb-1" style={{ color: "#6D28D9" }}>Spent</p>
                <p className="text-lg font-bold" style={{ color: "#7C3AFF" }}>
                  {Math.min(100, Math.round((summary.totalExpenses / summary.totalIncome) * 100))}%
                </p>
                <div className="w-16 h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(124,58,255,0.15)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((summary.totalExpenses / summary.totalIncome) * 100))}%`, background: "#7C3AFF" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expenses + Income */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl px-4 py-4" style={{
            backdropFilter: "blur(24px) saturate(1.6)",
            WebkitBackdropFilter: "blur(24px) saturate(1.6)",
            background: "linear-gradient(135deg, rgba(255,59,59,0.35), rgba(255,59,59,0.12))",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#B91C1C" }}>Expenses</p>
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,59,59,0.15)" }}>
                  <ArrowDownIcon className="h-3.5 w-3.5" style={{ color: "#FF3B3B" }} />
                </div>
              </div>
              {isLoadingSummary
                ? <Skeleton className="h-7 w-20" />
                : <p key={`expenses-${filterMode}`} className="text-xl font-bold truncate animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ color: "#FF3B3B" }}>{formatAmount(summary?.totalExpenses || 0)}</p>
              }
              <p className="text-[10px] font-semibold mt-1" style={{ color: "#B91C1C" }}>{periodLabel}</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl px-4 py-4" style={{
            backdropFilter: "blur(24px) saturate(1.6)",
            WebkitBackdropFilter: "blur(24px) saturate(1.6)",
            background: "linear-gradient(135deg, rgba(29,185,84,0.35), rgba(29,185,84,0.12))",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#15803D" }}>Income</p>
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(29,185,84,0.15)" }}>
                  <ArrowUpIcon className="h-3.5 w-3.5" style={{ color: "#1DB954" }} />
                </div>
              </div>
              {isLoadingSummary
                ? <Skeleton className="h-7 w-20" />
                : <p key={`income-${filterMode}`} className="text-xl font-bold truncate animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ color: "#1DB954" }}>{formatAmount(summary?.totalIncome || 0)}</p>
              }
              <p className="text-[10px] font-semibold mt-1" style={{ color: "#15803D" }}>{periodLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart + Top 3 ─────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-2">
          <div>
            <p className="text-sm font-bold text-foreground">
              {categoryType === "expense" ? "Spending" : "Income"} by Category
            </p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">{periodLabel}</p>
          </div>

          {/* Toggle — liquid glass slider, original */}
          <div
            className="relative flex items-center p-1 rounded-full shrink-0"
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
                transform: categoryType === "income" ? "translateX(100%)" : "translateX(0%)",
                background: categoryType === "income"
                  ? "linear-gradient(135deg, rgba(29,185,84,0.95), rgba(29,185,84,0.75))"
                  : "linear-gradient(135deg, rgba(255,59,59,0.95), rgba(255,59,59,0.75))",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.18)",
              }}
            />
            <button
              type="button"
              onClick={() => setCategoryType("expense")}
              className={cn(
                "relative z-10 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
                categoryType === "expense" ? "text-white" : "text-foreground/50 hover:text-foreground/70"
              )}
            >
              <TrendingDown className="h-3 w-3 shrink-0" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => setCategoryType("income")}
              className={cn(
                "relative z-10 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
                categoryType === "income" ? "text-white" : "text-foreground/50 hover:text-foreground/70"
              )}
            >
              <TrendingUp className="h-3 w-3 shrink-0" />
              Income
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-6">
          {/* Bar chart */}
          {isLoadingSpending ? (
            <Skeleton className="h-[200px] w-full" />
          ) : Array.isArray(spending) && spending.length > 0 ? (
            <div className="flex flex-col gap-4" ref={chartRef}>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartInView ? spending : []} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="categoryName" hide axisLine={{ stroke: "hsl(var(--border))", strokeWidth: 1.5 }} tickLine={false} />
                    <YAxis hide domain={[0, "dataMax"]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "10px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [formatAmount(value), categoryType === "expense" ? "Expense" : "Income"]}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive animationBegin={50} animationDuration={900} animationEasing="ease-in-out">
                      {spending.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.categoryColor} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-col gap-2.5">
                {spending.map((entry, idx) => (
                  <div
                    key={entry.categoryId}
                    className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-1"
                    style={{ animationDuration: "400ms", animationDelay: idx * 60 + "ms", animationFillMode: "backwards" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.categoryColor }} />
                        <span className="text-xs text-foreground font-medium truncate">{entry.categoryName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{entry.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: chartInView ? `${entry.percentage}%` : "0%", backgroundColor: entry.categoryColor }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground text-sm">
              <p>No {categoryType === "expense" ? "spending" : "income"} data yet.</p>
            </div>
          )}

          <div className="border-t border-border" />

          <div>
            <p className="text-sm font-bold mb-3">
              Top {categoryType === "expense" ? "Expenses" : "Income"}
            </p>
            {isLoadingTop ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5 w-32 mb-1.5" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : Array.isArray(topItems) && topItems.length > 0 ? (
              <div className="space-y-3">
                {topItems.slice(0, 3).map((expense: any, idx: number) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-1"
                    style={{ animationDuration: "400ms", animationDelay: idx * 80 + "ms", animationFillMode: "backwards" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                        style={{ background: `${MEDALS[idx].color}22`, border: `1.5px solid ${MEDALS[idx].color}55` }}
                      >
                        <span>{MEDALS[idx].emoji}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-none mb-1 truncate">{expense.description}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {expense.categoryName} · {formatDate(expense.date)}
                        </p>
                      </div>
                    </div>
                    <div className={cn("text-sm font-bold shrink-0", categoryType === "expense" ? "text-expense" : "text-income")}>
                      {categoryType === "expense" ? "-" : "+"}{formatAmount(expense.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm">
                <p>No {categoryType === "expense" ? "expenses" : "income"} found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
