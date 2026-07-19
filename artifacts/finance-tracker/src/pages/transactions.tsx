import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { Link } from "wouter";
import {
  useListTransactions,
  getListTransactionsQueryKey,
  useDeleteTransaction,
  useListCategories,
  getListCategoriesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/lib/currency-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FilterX, FolderPlus, ChevronDown, ChevronLeft, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, categoryTextColor, LIGHT_PAGE_BG, DARK_PAGE_BG } from "@/lib/utils";
import { PeriodWheelPicker } from "@/components/period-wheel-picker";
import { EntrySheet } from "@/components/dashboard/entry-sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";

// ─── TransactionRow — fila con swipe-to-delete, un solo gesto abierto a la vez ──
const SWIPE_WIDTH = 84;

// Mismo patrón que entry-sheet.tsx/settings.tsx: cachea el módulo tras el primer import.
let hapticsModule: any = null;
const triggerHaptic = () => {
  if (hapticsModule) {
    hapticsModule.Haptics.impact({ style: hapticsModule.ImpactStyle.Light }).catch(() => {});
  } else {
    import("@capacitor/haptics").then((mod) => {
      hapticsModule = mod;
      mod.Haptics.impact({ style: mod.ImpactStyle.Light }).catch(() => {});
    }).catch(() => {});
  }
};

function TransactionRow({
  tx,
  isOpen,
  onOpenChange,
  onSelect,
  onDelete,
  formatAmount,
}: {
  tx: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tx: any) => void;
  onDelete: (tx: any) => void;
  formatAmount: (n: number) => string;
}) {
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const firedByPointer = useRef(false);
  const [dragX, setDragX] = useState(isOpen ? -SWIPE_WIDTH : 0);

  // Si otra fila se abre (o algo la cierra desde afuera), seguimos ese estado
  // salvo que este mismo dedo esté arrastrando esta fila ahora mismo.
  useEffect(() => {
    if (!dragging.current) setDragX(isOpen ? -SWIPE_WIDTH : 0);
  }, [isOpen]);

  const isExpense = tx.type === "expense";

  function commitTap() {
    firedByPointer.current = true;
    if (isOpen) { setDragX(0); onOpenChange(false); return; }
    onSelect(tx);
  }

  function onPointerDown(e: React.PointerEvent) {
    startPos.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    // Sin esto, un swipe rápido puede "escaparse" del elemento a mitad de gesto
    // y el navegador deja de mandarle los pointermove — de ahí el "se traba a mitad de camino".
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMoveHandler(e: React.PointerEvent) {
    const start = startPos.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragging.current) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.3) { startPos.current = null; return; } // vertical → es scroll de la lista, no swipe de fila
      dragging.current = true;
    }
    e.preventDefault(); // evita que el scroll nativo pelee con el drag mientras arrastramos
    const base = isOpen ? -SWIPE_WIDTH : 0;
    setDragX(Math.min(0, Math.max(-SWIPE_WIDTH, base + dx)));
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = startPos.current;
    startPos.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!start) return;
    if (dragging.current) {
      dragging.current = false;
      const openNow = dragX < -SWIPE_WIDTH / 2;
      setDragX(openNow ? -SWIPE_WIDTH : 0);
      onOpenChange(openNow);
      firedByPointer.current = true;
      return;
    }
    commitTap();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <ConfirmDialog
        trigger={
          // El botón ocupa TODA la zona revelada (ancho completo + alto completo de la fila)
          // para que el toque responda en cualquier punto, no solo sobre el pill visual chico —
          // antes el hit-area era del tamaño del pill (44px alto centrado), y un toque un poco
          // arriba/abajo caía en zona muerta. El pill de abajo es solo decorativo/visual.
          <button
            type="button"
            onClick={() => triggerHaptic()}
            aria-label={`Delete ${tx.description}`}
            className="group absolute inset-y-0 right-0 z-10 flex items-center justify-center"
            style={{ width: SWIPE_WIDTH }}
          >
            <span
              className="flex items-center justify-center rounded-xl bg-destructive text-xs font-bold text-white transition-transform group-active:scale-95"
              style={{ width: 62, height: 44 }}
            >
              Delete
            </span>
          </button>
        }
        icon={Trash2}
        title="Delete transaction?"
        description={`This will permanently delete "${tx.description}". This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => onDelete(tx)}
      />
      <button
        type="button"
        data-testid={`row-transaction-${tx.id}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMoveHandler}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { startPos.current = null; dragging.current = false; }}
        onClick={() => {
          if (firedByPointer.current) { firedByPointer.current = false; return; }
          commitTap(); // activación por teclado (Enter/Espacio), sin pointer events antes
        }}
        className="relative w-full text-left flex items-center gap-3 px-1 py-5 bg-background"
        style={{
          touchAction: "pan-y",
          transform: `translateX(${dragX}px)`,
          transition: dragging.current ? "none" : "transform 280ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <span className="w-[3px] h-9 rounded-full shrink-0" style={{ background: tx.categoryColor }} aria-hidden="true" />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold leading-tight text-foreground">{tx.description}</span>
          <span className="mt-0.5 block truncate text-xs">
            <span
              className="cat-name-text font-semibold"
              style={{
                "--cat-text-light": categoryTextColor(tx.categoryColor, LIGHT_PAGE_BG),
                "--cat-text-dark": categoryTextColor(tx.categoryColor, DARK_PAGE_BG),
              } as CSSProperties}
            >
              {tx.categoryName}
            </span>
            <span className="text-muted-foreground/60"> · {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </span>
        </span>

        <span
          className={cn(
            "font-number shrink-0 text-[15px] leading-none",
            isExpense ? "text-[#7F1D1D] dark:text-[#FFA3A3]" : "text-[#00432C] dark:text-[#6EE7B7]"
          )}
        >
          {isExpense ? "−" : "+"}{formatAmount(tx.amount)}
        </span>
      </button>
    </div>
  );
}

// ─── TransactionList — ledger continuado, sin caja envolvente ─────────────────
function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function TransactionList({ filteredTransactions, isLoading, formatAmount, onSelect, onDelete }: {
  filteredTransactions: any[] | undefined;
  isLoading: boolean;
  formatAmount: (n: number) => string;
  onSelect: (tx: any) => void;
  onDelete: (tx: any) => void;
}) {
  const thisMonth = currentYM();

  // Agrupar por mes
  const groups: Record<string, any[]> = {};
  (filteredTransactions ?? []).forEach(tx => {
    const key = tx.date.slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(tx);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  // Mes actual siempre abierto, el resto colapsado por defecto
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Una sola fila con el swipe abierto a la vez, en toda la lista
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);

  // Si el usuario hace scroll de verdad con una fila abierta, la cerramos —
  // pero no con cualquier scroll mínimo (rebote del overscroll, etc.), solo
  // pasado un umbral real de desplazamiento acumulado.
  const SCROLL_CLOSE_THRESHOLD = 24;
  useEffect(() => {
    if (openSwipeId === null) return;
    const scrollEl = document.querySelector<HTMLElement>("[data-app-scroll]");
    if (!scrollEl) return;
    const startTop = scrollEl.scrollTop;
    const onScroll = () => {
      if (Math.abs(scrollEl.scrollTop - startTop) > SCROLL_CLOSE_THRESHOLD) {
        setOpenSwipeId(null);
      }
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [openSwipeId]);

  const isCollapsed = (key: string) => {
    if (key in collapsed) return collapsed[key];
    return key !== thisMonth; // default: solo el mes actual abierto
  };

  const toggle = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !isCollapsed(key) }));

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-3.5">
          <Skeleton className="h-9 w-[3px] rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );

  if (!filteredTransactions?.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Search className="h-10 w-10 mb-3 opacity-30" />
      <p className="font-semibold text-foreground">No transactions found</p>
      <p className="text-sm mt-1">Try adjusting your filters or adding a new one.</p>
    </div>
  );

  return (
    <div>
      {sortedKeys.map(monthKey => {
        const [y, m] = monthKey.split("-").map(Number);
        const monthLabel = new Date(y, m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const txs = groups[monthKey]!;
        const open = !isCollapsed(monthKey);

        return (
          <div key={monthKey} className="mt-6 first:mt-0">
            {/* Header del mes — clickeable, sin fondo */}
            <button
              type="button"
              className="flex w-full items-center justify-between border-b border-border py-3.5"
              onClick={() => toggle(monthKey)}
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown
                  className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200"
                  style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
                />
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{monthLabel}</span>
              </span>
              <span className="text-[11px] text-muted-foreground/60">
                {txs.length} {txs.length === 1 ? "item" : "items"}
              </span>
            </button>

            {/* Items del mes */}
            {open && (
              <div className="mt-1 space-y-2">
                {txs.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    isOpen={openSwipeId === tx.id}
                    onOpenChange={(o) => setOpenSwipeId(o ? tx.id : null)}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    formatAmount={formatAmount}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Transactions() {
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrency();
  const { toast } = useToast();
  const deleteTx = useDeleteTransaction();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const handleTypeChange = (val: string) => {
    setFilterType(val);
    setFilterCategory("all");
  };

  const handleDeleteTx = useCallback((tx: any) => {
    deleteTx.mutate({ id: tx.id }, {
      onSuccess: () => {
        toast({ title: "Transaction deleted" });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 3 }) });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  }, [deleteTx, toast, queryClient]);

  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  const filteredCategoryOptions = Array.isArray(categories)
  ? categories.filter((c) => {
      if (filterType === "all") return true;
      return c.type === filterType || c.type === "both";
    })
  : [];

  const queryParams = {
    ...(filterType !== "all" && { type: filterType as "income" | "expense" }),
    ...(filterCategory !== "all" && { categoryId: parseInt(filterCategory) }),
  };

  const { data: transactions, isLoading } = useListTransactions(queryParams, {
    query: { queryKey: getListTransactionsQueryKey(queryParams) },
  });

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const filteredTransactions = filterMonth
    ? safeTransactions.filter((tx) => tx.date.startsWith(filterMonth))
    : safeTransactions;

  const hasFilters = filterType !== "all" || filterCategory !== "all" || filterMonth !== "";
  const resetFilters = () => { setFilterType("all"); setFilterCategory("all"); setFilterMonth(""); };

  const monthlyTotal = filteredTransactions?.reduce(
    (acc, tx) => { if (tx.type === "income") acc.income += tx.amount; else acc.expense += tx.amount; return acc; },
    { income: 0, expense: 0 }
  );

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* iOS no tiene botón de "atrás" físico como Android — esta página se
          entra siempre desde Dashboard, así que el destino es fijo. */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <h2 className="font-title text-2xl text-foreground pr-14 min-h-10 flex items-center">Transactions</h2>

      {/* Filters — sección plana con hairline, sin card ni sombra (mismo lenguaje que el resto del app) */}
      <div className="space-y-2.5 border-b border-border pb-4">
        {/* Type — toggle plano, mismo lenguaje que el resto de la app */}
        <div className="flex gap-1.5 rounded-2xl bg-muted p-1">
          {([
            { key: "all", label: "All" },
            { key: "income", label: "Income" },
            { key: "expense", label: "Expense" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTypeChange(t.key)}
              className={cn(
                "flex-1 rounded-xl py-2 text-xs font-bold transition-colors",
                filterType === t.key ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-10 text-sm bg-muted/50 border-0 rounded-2xl px-3 [&>span]:truncate">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {filteredCategoryOptions.length === 0 ? (
                <div className="py-2 px-1">
                  <Link href="/categories" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="w-full flex items-center gap-2 px-2 py-2 rounded-2xl text-sm text-primary hover:bg-primary/10 transition-colors">
                      <FolderPlus className="h-4 w-4 shrink-0" />
                      Add a category
                    </button>
                  </Link>
                </div>
              ) : (
                filteredCategoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Period — toggle Specific/All Time + ruedas de mes/año, se ocultan en All Time */}
        <PeriodWheelPicker
          value={filterMonth}
          onChange={setFilterMonth}
          trailing={
            hasFilters ? (
              <button
                onClick={resetFilters}
                className="h-10 w-10 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0"
                title="Reset filters"
              >
                <FilterX className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ) : undefined
          }
        />

        {/* Summary strip — texto plano, sin tinte de fondo (el color lo lleva el número, no la caja) */}
        {(filterMonth !== "" || filterType !== "all") && monthlyTotal && (
          <div className="flex gap-5 pt-0.5">
            {(filterType === "all" || filterType === "income") && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Income</p>
                <p className="font-number text-xs font-bold text-[#00432C] dark:text-[#6EE7B7]">{formatAmount(monthlyTotal.income)}</p>
              </div>
            )}
            {(filterType === "all" || filterType === "expense") && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Expenses</p>
                <p className="font-number text-xs font-bold text-[#7F1D1D] dark:text-[#FFA3A3]">{formatAmount(monthlyTotal.expense)}</p>
              </div>
            )}
            {filterType === "all" && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Balance</p>
                <p className={cn("font-number text-xs font-bold", monthlyTotal.income - monthlyTotal.expense >= 0 ? "text-[#00432C] dark:text-[#6EE7B7]" : "text-[#7F1D1D] dark:text-[#FFA3A3]")}>
                  {formatAmount(monthlyTotal.income - monthlyTotal.expense)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={() => setCreating(true)}
        className="w-full gap-2 bg-[#CAFA01] text-black border-0 font-bold transition-transform active:scale-95"
        data-testid="button-add-transaction"
      >
        <Plus className="h-4 w-4" />
        Add Transaction
      </Button>

      {/* Transaction list — ledger continuado, con swipe-to-delete por fila */}
      <TransactionList
        filteredTransactions={filteredTransactions}
        isLoading={isLoading}
        formatAmount={formatAmount}
        onSelect={setSelectedTx}
        onDelete={handleDeleteTx}
      />

      {/* Add / Edit — mismo EntrySheet que "New Entry" en el dashboard */}
      <EntrySheet open={creating} onClose={() => setCreating(false)} />
      <EntrySheet open={!!selectedTx} onClose={() => setSelectedTx(null)} tx={selectedTx} />
    </div>
  );
}