import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetSpendingByCategory, getGetSpendingByCategoryQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { RangeSwitch } from "@/components/dashboard/range-switch";
import { EntryLauncher } from "@/components/dashboard/entry-launcher";
import { EntrySheet } from "@/components/dashboard/entry-sheet";
import { SpendingBreakdown } from "@/components/dashboard/spending-breakdown";
import VoiceCapture, { type ParsedVoiceTx } from "@/components/voice-capture";
import { billsQueryOptions, type Bill } from "@/pages/goals";

/** Últimos `n` meses terminando en el actual — ventana rodante, no año calendario:
 * acá es solo un preview de tendencia reciente para "All Time", no algo editable
 * donde la posición exacta importe (a diferencia del grid de BillDetail en Goals). */
function lastNMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** Fracción de bills pagados en un mes dado — intensidad del heatmap agregado. */
function monthIntensity(bills: Bill[], month: string): number {
  if (bills.length === 0) return 0;
  return bills.filter((b) => b.logs.includes(month)).length / bills.length;
}

// Hairline arriba/abajo (igual que EntryLauncher) + feedback de press — sin esto
// era la única fila tappable del dashboard sin superficie propia ni estado táctil.
const BILLS_SECTION_CLS =
  "mt-6 border-y border-border py-4 transition-[opacity,transform] duration-150 active:opacity-75 active:scale-[0.985] group";

function BillsWidget({ filterMode }: { filterMode: "month" | "all" }) {
  const { data: rawBills, isLoading } = useQuery(billsQueryOptions);
  // Este widget es solo "plata que sale" — los Flows de income (salario, etc.) no
  // son "bills a pagar", así que no cuentan acá aunque compartan la misma tabla.
  const bills = (rawBills ?? []).filter((b) => b.type === "expense");

  if (isLoading) return null;

  if (bills.length === 0) {
    return (
      <Link href="/goals?tab=bills" className={cn(BILLS_SECTION_CLS, "block")}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Money Out</p>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Track recurring bills — insurance, rent, subscriptions</p>
      </Link>
    );
  }

  if (filterMode === "month") {
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
      <Link href="/goals?tab=bills" className={cn(BILLS_SECTION_CLS, "flex items-center gap-4")}>
        <div className="shrink-0 text-center leading-none">
          <p className="font-entry-amount leading-[0.75]" style={{ fontSize: "3rem", color: "#FF66D9" }}>
            {paid}
          </p>
          <p className="mt-1.5 text-[11px] font-bold text-muted-foreground">of {total}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Money Out</p>
          <p className="mt-1 text-[13px] leading-snug text-foreground">{caption}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
      </Link>
    );
  }

  // All Time — misma gramática que Month: número hero + sparkline de historial
  // como detalle secundario (no protagonista, ya no compite con el número).
  const months = lastNMonths(12);
  const fullyPaidMonths = months.filter((m) => monthIntensity(bills, m) === 1).length;

  return (
    <Link href="/goals?tab=bills" className={cn(BILLS_SECTION_CLS, "flex items-center gap-4")}>
      <div className="shrink-0 text-center leading-none">
        <p className="font-entry-amount leading-[0.75]" style={{ fontSize: "3rem", color: "#FF66D9" }}>
          {fullyPaidMonths}
        </p>
        <p className="mt-1.5 text-[11px] font-bold text-muted-foreground">of {months.length}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Money Out</p>
        <p className="mt-1 text-[13px] leading-snug text-foreground">Months fully paid this year</p>
        <div className="mt-2 grid grid-cols-12 gap-[3px]">
          {months.map((m) => {
            const intensity = monthIntensity(bills, m);
            const alpha = intensity > 0 ? Math.round(Math.max(0.3, intensity) * 255).toString(16).padStart(2, "0") : "";
            return (
              <div
                key={m}
                className="h-[5px] rounded-full"
                style={{ background: intensity > 0 ? `#FF66D9${alpha}` : "hsl(var(--muted-foreground) / 0.15)" }}
              />
            );
          })}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
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
      <BillsWidget filterMode={filterMode} />

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
