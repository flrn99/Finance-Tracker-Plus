import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetSpendingByCategory, getGetSpendingByCategoryQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, ChevronRight, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { useCurrency } from "@/lib/currency-context";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { RangeSwitch } from "@/components/dashboard/range-switch";
import { EntryLauncher } from "@/components/dashboard/entry-launcher";
import { EntrySheet } from "@/components/dashboard/entry-sheet";
import { SpendingBreakdown } from "@/components/dashboard/spending-breakdown";
import VoiceCapture, { type ParsedVoiceTx } from "@/components/voice-capture";
import { billsQueryOptions } from "@/pages/goals";

const BILLS_COLOR = "#e6b3e7";

function BillsWidget() {
  const { data: bills, isLoading } = useQuery(billsQueryOptions);

  if (isLoading) return null;

  if (!bills || bills.length === 0) {
    return (
      <Link href="/goals?tab=bills" className="mt-8 block">
        <button className="w-full rounded-2xl border p-4 text-left transition-opacity active:opacity-80" style={{ borderColor: `${BILLS_COLOR}40`, background: `${BILLS_COLOR}10` }}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${BILLS_COLOR}30` }}>
              <CreditCard className="h-4.5 w-4.5" style={{ color: BILLS_COLOR }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight text-foreground">Track your monthly bills</p>
              <p className="truncate text-[11px] text-muted-foreground">Insurance, rent, subscriptions — mark them paid each month</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          </div>
        </button>
      </Link>
    );
  }

  const paid = bills.filter((b) => b.paidThisMonth).length;
  const total = bills.length;
  const paidNames = bills.filter((b) => b.paidThisMonth).map((b) => b.name);
  const caption =
    paid === 0
      ? `${total} bill${total === 1 ? "" : "s"} to pay this month`
      : paid === total
        ? "All bills paid this month"
        : `${paidNames.slice(0, 2).join(", ")}${paidNames.length > 2 ? " & more" : ""} paid this month`;

  return (
    <Link href="/goals?tab=bills" className="mt-8 block">
      <button className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-opacity active:opacity-80" style={{ borderColor: `${BILLS_COLOR}40`, background: `${BILLS_COLOR}10` }}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${BILLS_COLOR}30` }}>
          <CreditCard className="h-4.5 w-4.5" style={{ color: BILLS_COLOR }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-number text-lg leading-tight text-foreground">
            {paid}<span className="text-xs text-muted-foreground">/{total} paid</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{caption}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      </button>
    </Link>
  );
}

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
    <div className="pb-4">
      <h2 className="font-title flex min-h-10 items-center pr-14 text-3xl text-foreground">Dashboard</h2>

      {/* New entry launcher */}
      <div className="mt-6">
        <EntryLauncher onOpen={() => { setVoiceDraft(null); setSheetOpen(true); }} onVoice={() => setVoiceOpen(true)} />
      </div>

      {/* Range switch */}
      <div className="mt-6">
        <RangeSwitch value={filterMode} onChange={setFilterMode} />
      </div>

      {/* Balance hero */}
      <div className="mt-8">
        {isLoadingSummary ? (
          <div className="space-y-3">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-12 w-40 rounded-lg" />
            <Skeleton className="h-4 w-48 rounded-lg" />
          </div>
        ) : (
          <BalanceHero
            balance={formatAmount(summary?.balance || 0)}
            caption={periodLabel}
            expenseAmount={formatAmount(summary?.totalExpenses || 0)}
            incomeAmount={formatAmount(summary?.totalIncome || 0)}
          />
        )}
      </div>

      {/* All transactions link */}
      <Link href="/transactions" className="mt-8 block">
        <button className="group flex w-full items-center gap-4 rounded-2xl bg-foreground p-4 text-left transition-opacity active:opacity-80">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-background">
            <ArrowLeftRight className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold tracking-tight text-background">All transactions</span>
            <span className="block truncate text-sm text-background/60">Browse and edit your full history</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-background/60 transition-transform group-hover:translate-x-1" strokeWidth={2} />
        </button>
      </Link>

      {/* Monthly bills widget */}
      <BillsWidget />

      {/* Spending breakdown */}
      <div className="mt-8">
        <SpendingBreakdown
          type={categoryType}
          onTypeChange={setCategoryType}
          periodLabel={periodLabel}
          data={Array.isArray(spending) ? spending : undefined}
          isLoading={isLoadingSpending}
          chartInView={chartInView}
          chartRef={chartRef}
        />
      </div>

      <EntrySheet open={sheetOpen} onClose={() => { setSheetOpen(false); setVoiceDraft(null); }} initial={voiceDraft} />
      {voiceOpen && <VoiceCapture onClose={() => setVoiceOpen(false)} onParsed={applyVoice} />}
    </div>
  );
}
