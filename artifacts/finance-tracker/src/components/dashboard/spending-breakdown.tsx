import { useEffect, useRef, useState, type RefObject } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/currency-context";
import { Skeleton } from "@/components/ui/skeleton";

type SpendingEntry = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  total: number;
  percentage: number;
};

const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const CARD_WIDTH = 128;
const RING_R = 32;
const RING_STROKE = 7;

function MiniOverview({
  data,
  maxTotal,
  grown,
  activeIndex,
  onSelect,
}: {
  data: SpendingEntry[];
  maxTotal: number;
  grown: boolean;
  activeIndex: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex items-end gap-1 h-16 mb-4 border-b border-border pb-1">
      {data.map((entry, idx) => {
        const pct = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0;
        const isActive = idx === activeIndex;
        return (
          <button
            key={entry.categoryId}
            type="button"
            onClick={() => onSelect(idx)}
            className="flex-1 min-w-0 rounded-t-lg"
            style={{
              height: grown ? `${Math.max(pct, 10)}%` : "0%",
              backgroundColor: entry.categoryColor,
              opacity: isActive ? 1 : 0.35,
              transitionProperty: "height, opacity",
              transitionDuration: "600ms, 250ms",
              transitionTimingFunction: `${SPRING_EASE}, ease-out`,
              transitionDelay: `${idx * 45}ms, 0ms`,
            }}
            aria-label={entry.categoryName}
          />
        );
      })}
    </div>
  );
}

function CategoryCard({
  entry,
  pct,
  isActive,
  grown,
  delay,
  amountLabel,
}: {
  entry: SpendingEntry;
  pct: number;
  isActive: boolean;
  grown: boolean;
  delay: number;
  amountLabel: string;
}) {
  const circumference = 100;
  const gapPct = 4;
  const segLen = grown ? Math.max(pct - gapPct, 0) : 0;

  return (
    <div
      className="snap-center shrink-0 flex flex-col items-center gap-2 rounded-3xl bg-muted/50 px-3 py-4 animate-in fade-in slide-in-from-bottom-2"
      style={{
        width: CARD_WIDTH,
        transform: isActive ? "scale(1)" : "scale(0.9)",
        opacity: isActive ? 1 : 0.55,
        transitionProperty: "transform, opacity",
        transitionDuration: "300ms",
        transitionTimingFunction: "ease-out",
        animationDuration: "450ms",
        animationDelay: `${delay}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="relative" style={{ width: 76, height: 76 }}>
        <svg width={76} height={76} viewBox="0 0 76 76">
          <circle cx={38} cy={38} r={RING_R} fill="none" stroke="hsl(var(--muted-foreground) / 0.15)" strokeWidth={RING_STROKE} />
          <circle
            cx={38}
            cy={38}
            r={RING_R}
            fill="none"
            stroke={entry.categoryColor}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            pathLength={circumference}
            strokeDasharray={`${segLen} ${circumference}`}
            transform="rotate(-90 38 38)"
            style={{ transition: `stroke-dasharray 700ms ${SPRING_EASE}`, transitionDelay: `${delay}ms` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold tabular-nums text-foreground">{Math.round(pct)}%</span>
        </div>
      </div>
      <p className="text-xs font-semibold text-foreground text-center truncate max-w-full">{entry.categoryName}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">{amountLabel}</p>
    </div>
  );
}

export function SpendingBreakdown({
  type,
  onTypeChange,
  periodLabel,
  data,
  isLoading,
  chartInView,
  chartRef,
}: {
  type: "expense" | "income";
  onTypeChange: (type: "expense" | "income") => void;
  periodLabel: string;
  data: SpendingEntry[] | undefined;
  isLoading: boolean;
  chartInView: boolean;
  chartRef: RefObject<HTMLDivElement>;
}) {
  const { formatAmount } = useCurrency();
  const isExpense = type === "expense";
  const GhostIcon = isExpense ? TrendingDown : TrendingUp;

  const maxTotal = data && data.length > 0 ? Math.max(...data.map((d) => d.total)) : 0;
  const total = data ? data.reduce((sum, d) => sum + d.total, 0) : 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const ratiosRef = useRef<Map<number, number>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);

  // Retrigger the grow-in animation every time the dataset changes (type toggle or fresh fetch)
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    setActiveIndex(0);
    ratiosRef.current.clear();
    scrollRef.current?.scrollTo({ left: 0 });
    if (!chartInView || !data || data.length === 0) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [type, data, chartInView]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !data || data.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          ratiosRef.current.set(idx, e.intersectionRatio);
        });
        let best = 0;
        let bestRatio = -1;
        ratiosRef.current.forEach((ratio, idx) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = idx;
          }
        });
        setActiveIndex(best);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [data]);

  const scrollToIndex = (idx: number) => {
    setActiveIndex(idx);
    cardRefs.current.get(idx)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-card p-5 shadow-sm"
      style={{ border: "1.5px solid hsl(var(--card-border))" }}
    >
      {/* Sheen glass superior */}
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: "linear-gradient(180deg, hsl(var(--foreground) / 0.03) 0%, transparent 100%)" }} />
      {/* Ícono fantasma — neutro, solo decorativo */}
      <GhostIcon className="absolute -bottom-6 -right-5 h-36 w-36 pointer-events-none" style={{ color: "hsl(var(--foreground) / 0.05)" }} strokeWidth={1.5} />

      <div className="relative mb-4">
        <p className="text-base font-bold text-foreground mb-3">
          {isExpense ? "Spending" : "Income"} by Category
        </p>

        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{periodLabel}</p>
            <p className="font-serif text-xl font-bold tabular-nums text-foreground leading-tight">{formatAmount(total)}</p>
          </div>

          {/* Toggle — liquid glass slider */}
          <div
            className="relative flex items-center p-1 rounded-full shrink-0"
            style={{
              backdropFilter: "blur(24px) saturate(1.6)",
              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              background: "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.15))",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <div
              className="absolute top-1 left-1 rounded-full transition-transform duration-300 ease-out"
              style={{
                bottom: "4px",
                width: "calc(50% - 4px)",
                transform: isExpense ? "translateX(0%)" : "translateX(100%)",
                background: isExpense
                  ? "linear-gradient(135deg, rgba(255,59,59,0.95), rgba(255,59,59,0.75))"
                  : "linear-gradient(135deg, rgba(29,185,84,0.95), rgba(29,185,84,0.75))",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.18)",
              }}
            />
            <button
              type="button"
              onClick={() => onTypeChange("expense")}
              className={cn(
                "relative z-10 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
                isExpense ? "text-white" : "text-foreground/50 hover:text-foreground/70"
              )}
            >
              <TrendingDown className="h-3 w-3 shrink-0" />
              Expense
            </button>
            <button
              type="button"
              onClick={() => onTypeChange("income")}
              className={cn(
                "relative z-10 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors duration-300 whitespace-nowrap rounded-full",
                !isExpense ? "text-white" : "text-foreground/50 hover:text-foreground/70"
              )}
            >
              <TrendingUp className="h-3 w-3 shrink-0" />
              Income
            </button>
          </div>
        </div>
      </div>

      <div className="relative" ref={chartRef}>
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full rounded-full" />
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[152px] rounded-3xl" style={{ width: CARD_WIDTH }} />)}
            </div>
          </div>
        ) : data && data.length > 0 ? (
          <div key={type}>
            <MiniOverview data={data} maxTotal={maxTotal} grown={grown} activeIndex={activeIndex} onSelect={scrollToIndex} />

            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1"
              style={{
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
                paddingLeft: `calc(50% - ${CARD_WIDTH / 2}px)`,
                paddingRight: `calc(50% - ${CARD_WIDTH / 2}px)`,
              }}
            >
              {data.map((entry, idx) => (
                <div
                  key={entry.categoryId}
                  data-idx={idx}
                  ref={(el) => {
                    if (el) cardRefs.current.set(idx, el);
                    else cardRefs.current.delete(idx);
                  }}
                >
                  <CategoryCard
                    entry={entry}
                    pct={total > 0 ? (entry.total / total) * 100 : 0}
                    isActive={idx === activeIndex}
                    grown={grown}
                    delay={idx * 60}
                    amountLabel={formatAmount(entry.total)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-sm text-muted-foreground">
            <p>No {isExpense ? "spending" : "income"} data yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
