import { useState, useMemo, useRef, useEffect } from "react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetSpendingByCategory, getGetSpendingByCategoryQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useCurrency } from "@/lib/currency-context";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { StatTiles } from "@/components/dashboard/stat-tiles";
import { RangeSwitch } from "@/components/dashboard/range-switch";
import { EntryLauncher } from "@/components/dashboard/entry-launcher";
import { EntrySheet } from "@/components/dashboard/entry-sheet";
import { SpendingBreakdown } from "@/components/dashboard/spending-breakdown";
import VoiceCapture, { type ParsedVoiceTx } from "@/components/voice-capture";

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
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<{ type?: "expense" | "income"; amount?: number; categoryId?: number; note?: string } | null>(null);

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

  const spentPct = summary && summary.totalIncome > 0
    ? Math.min(100, Math.round((summary.totalExpenses / summary.totalIncome) * 100))
    : 0;

  const applyVoice = (tx: ParsedVoiceTx) => {
    setVoiceOpen(false);
    setVoiceDraft({
      type: tx.type,
      amount: tx.amount > 0 ? tx.amount : undefined,
      categoryId: tx.categoryId ?? undefined,
      note: tx.description || undefined,
    });
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4 pb-4">
      <h2 className="font-title text-3xl font-bold text-foreground pr-14 min-h-10 flex items-center" style={{ letterSpacing: "-0.01em" }}>Dashboard</h2>

      {/* New entry launcher */}
      <EntryLauncher onOpen={() => { setVoiceDraft(null); setSheetOpen(true); }} onVoice={() => setVoiceOpen(true)} />

      {/* Range switch */}
      <RangeSwitch value={filterMode} onChange={setFilterMode} />

      {/* Balance hero */}
      {isLoadingSummary
        ? <Skeleton className="h-48 w-full rounded-3xl" />
        : <BalanceHero balance={formatAmount(summary?.balance || 0)} spentPct={spentPct} caption={periodLabel} />
      }

      {/* Expense / Income tiles */}
      {isLoadingSummary
        ? <div className="grid grid-cols-2 gap-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-32 rounded-3xl" /></div>
        : <StatTiles caption={periodLabel} expense={formatAmount(summary?.totalExpenses || 0)} income={formatAmount(summary?.totalIncome || 0)} />
      }

      {/* All transactions link */}
      <Link href="/transactions" className="block">
        <button className="group flex w-full items-center gap-4 rounded-3xl bg-card p-4 text-left transition-colors hover:bg-muted" style={{ border: "1.5px solid #020203" }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: "#020203" }}>
            <ArrowLeftRight className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold tracking-tight text-foreground">All transactions</span>
            <span className="block truncate text-sm text-muted-foreground">Browse and edit your full history</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" strokeWidth={2} />
        </button>
      </Link>

      {/* Spending breakdown */}
      <SpendingBreakdown
        type={categoryType}
        onTypeChange={setCategoryType}
        periodLabel={periodLabel}
        data={Array.isArray(spending) ? spending : undefined}
        isLoading={isLoadingSpending}
        chartInView={chartInView}
        chartRef={chartRef}
      />

      <EntrySheet open={sheetOpen} onClose={() => { setSheetOpen(false); setVoiceDraft(null); }} initial={voiceDraft} />
      {voiceOpen && <VoiceCapture onClose={() => setVoiceOpen(false)} onParsed={applyVoice} />}
    </div>
  );
}
