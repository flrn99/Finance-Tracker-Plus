import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Any" es un sentinel arriba de enero — scrollearlo hasta ahí filtra por año
// completo (sin mes), reusando el mismo mecanismo de rueda en vez de un tercer
// estado en el toggle.
const MONTH_ITEMS = ["Any", ...MONTH_LABELS];
const ANY_SENTINEL = new Set([0]);
const ITEM_HEIGHT = 32;
const WHEEL_HEIGHT = 96;
const WHEEL_PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

/** Una columna de la rueda — snap nativo + escala/opacidad por distancia al centro. */
function Wheel({
  items,
  selectedIndex,
  onSelect,
  disabledIndexes,
  sentinelIndexes,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  disabledIndexes?: Set<number>;
  sentinelIndexes?: Set<number>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const updateScale = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    el.querySelectorAll<HTMLElement>("[data-wheel-item]").forEach((child) => {
      const r = child.getBoundingClientRect();
      const itemCenter = r.top + r.height / 2;
      const dist = Math.abs(itemCenter - center);
      const norm = Math.min(dist / (rect.height / 2), 1);
      child.style.transform = `scale(${1 - norm * 0.32})`;
      child.style.opacity = String(1 - norm * 0.82);
    });
  }, []);

  // Centra la rueda en selectedIndex cuando cambia desde afuera (o al montar).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.querySelector<HTMLElement>(`[data-wheel-item="${selectedIndex}"]`);
    if (!child) return;
    const rect = el.getBoundingClientRect();
    el.scrollTop = child.offsetTop - (rect.height / 2 - child.offsetHeight / 2);
    updateScale();
  }, [selectedIndex, updateScale]);

  function handleScroll() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => { updateScale(); rafRef.current = null; });

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      let closestIdx = selectedIndex;
      let closestDist = Infinity;
      el.querySelectorAll<HTMLElement>("[data-wheel-item]").forEach((child) => {
        const r = child.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - center);
        if (dist < closestDist) { closestDist = dist; closestIdx = Number(child.dataset.wheelItem); }
      });
      if (closestIdx !== selectedIndex && !disabledIndexes?.has(closestIdx)) {
        onSelect(closestIdx);
      }
    }, 120);
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-full flex-1 overflow-y-scroll [-webkit-overflow-scrolling:touch] [scroll-snap-type:y_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)",
      }}
    >
      <div style={{ height: WHEEL_PAD }} />
      {items.map((label, i) => (
        <div
          key={i}
          data-wheel-item={i}
          onClick={() => !disabledIndexes?.has(i) && onSelect(i)}
          className={cn(
            "font-number flex cursor-pointer items-center justify-center text-sm uppercase tracking-wide [scroll-snap-align:center]",
            disabledIndexes?.has(i) ? "text-muted-foreground/30" : "text-foreground",
            sentinelIndexes?.has(i) && "italic"
          )}
          style={{ height: ITEM_HEIGHT }}
        >
          {label}
        </div>
      ))}
      <div style={{ height: WHEEL_PAD }} />
    </div>
  );
}

/**
 * Reemplaza los dos <select> nativos de mes/año en Transactions. Toggle "Specific
 * period / All Time" (mismo lenguaje que RangeSwitch) + dos ruedas independientes
 * con snap nativo — al elegir All Time, las ruedas se OCULTAN (no se atenúan).
 */
export function PeriodWheelPicker({
  value,
  onChange,
  trailing,
}: {
  value: string; // "" = all time, "YYYY" = año completo, "YYYY-MM" = mes específico
  onChange: (v: string) => void;
  trailing?: React.ReactNode;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth(); // 0-11
  const currentMonthWheelIdx = currentMonthIdx + 1; // +1 por el sentinel "Any" en 0

  const mode: "all" | "period" = value ? "period" : "all";
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [yStr, mStr] = value ? value.split("-") : [String(currentYear), undefined];
  const selectedYear = value ? parseInt(yStr!, 10) : currentYear;
  // Índice en MONTH_ITEMS: 0 = "Any" (sin mes, filtra por año completo), 1-12 = Jan-Dec
  const selectedMonthWheelIdx = mStr ? parseInt(mStr, 10) : mode === "period" ? 0 : currentMonthWheelIdx;
  const yearIndex = Math.max(0, years.indexOf(selectedYear));

  const disabledMonths =
    selectedYear === currentYear
      ? new Set(Array.from({ length: 12 - currentMonthWheelIdx }, (_, i) => currentMonthWheelIdx + 1 + i))
      : undefined;

  function commit(monthWheelIdx: number, yearIdx: number) {
    const year = years[yearIdx];
    onChange(monthWheelIdx === 0 ? String(year) : `${year}-${String(monthWheelIdx).padStart(2, "0")}`);
  }

  function handleEnterPeriod() {
    if (mode === "all") commit(currentMonthWheelIdx, 0);
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative grid flex-1 grid-cols-2 rounded-2xl bg-muted p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-foreground transition-transform duration-300 ease-out"
            style={{ transform: mode === "all" ? "translateX(100%)" : "translateX(0)" }}
          />
          <button
            type="button"
            onClick={handleEnterPeriod}
            className={cn(
              "relative z-10 py-2 text-xs font-bold transition-colors duration-300",
              mode === "period" ? "text-background" : "text-muted-foreground"
            )}
          >
            Specific period
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            className={cn(
              "relative z-10 py-2 text-xs font-bold transition-colors duration-300",
              mode === "all" ? "text-background" : "text-muted-foreground"
            )}
          >
            All Time
          </button>
        </div>
        {trailing}
      </div>

      {/* Colapsable con grid-template-rows — sin JS, sin medir alturas */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: mode === "period" ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-2 flex overflow-hidden border-t border-b border-border" style={{ height: WHEEL_HEIGHT }}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-b border-border"
              style={{ height: ITEM_HEIGHT }}
            />
            <Wheel
              items={MONTH_ITEMS}
              selectedIndex={selectedMonthWheelIdx}
              onSelect={(i) => commit(i, yearIndex)}
              disabledIndexes={disabledMonths}
              sentinelIndexes={ANY_SENTINEL}
            />
            <Wheel
              items={years.map(String)}
              selectedIndex={yearIndex}
              onSelect={(i) => {
                const newYear = years[i];
                const m =
                  selectedMonthWheelIdx !== 0 && newYear === currentYear && selectedMonthWheelIdx > currentMonthWheelIdx
                    ? currentMonthWheelIdx
                    : selectedMonthWheelIdx;
                commit(m, i);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
