import { useState, useRef } from "react";
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
import { formatDate } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FilterX, Trash2, TrendingUp, TrendingDown, FolderPlus, Pencil, X, Check, Calendar, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import MonthSelect from "@/components/month-select";

// ─── Transaction Edit Modal (Estilo Revolut Compact Friendly + Full Buttons) ──
function TransactionModal({ tx, categories, onClose }: { tx: any; categories: any[]; onClose: () => void }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { symbol } = useCurrency();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [amount, setAmount] = useState<number>(tx.amount);
  const [amountDisplay, setAmountDisplay] = useState<string>(
    tx.amount ? tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
  );
  const [type, setType] = useState<"income" | "expense">(tx.type);
  const [description, setDescription] = useState(tx.description);
  // Se recuerda la categoría por separado para cada tipo, así si el usuario
  // alterna entre Expense/Income sin guardar, no pierde la selección original.
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | undefined>(
    tx.type === "expense" ? tx.categoryId : undefined
  );
  const [incomeCategoryId, setIncomeCategoryId] = useState<number | undefined>(
    tx.type === "income" ? tx.categoryId : undefined
  );
  const [date, setDate] = useState(tx.date);
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const justClosedRef = useRef(false);


  const categoryId = type === "income" ? incomeCategoryId : expenseCategoryId;
  const setCategoryIdForType = (id: number) => {
    if (type === "income") setIncomeCategoryId(id);
    else setExpenseCategoryId(id);
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === "both");

  const isIncome = type === "income";
  const accentColor = isIncome ? "#1DB954" : "#FF3B3B";

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 3 }) });
  };

  const handleSave = async () => {
    if (!categoryId) {
      toast({ title: "Select a category", description: "Choose a category before saving.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/transactions/${tx.id}`), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, amount, description, categoryId, date, notes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Transaction updated" });
      invalidateAll();
      onClose();
    } catch {
      toast({ title: "Failed to update transaction", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTx = useDeleteTransaction();
  const handleDelete = () => {
    deleteTx.mutate({ id: tx.id }, {
      onSuccess: () => {
        toast({ title: "Transaction deleted" });
        invalidateAll();
        onClose();
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  // No usamos scrollIntoView en los inputs: con el overlay anclado al
  // visualViewport real, el teclado nativo ya reposiciona el modal y un
  // scroll JS adicional generaba el "salto" del modal completo.
  const focusCenter = (_e: React.FocusEvent<HTMLElement>) => {};

  // Para Notes: scroll suave hasta los botones después de que el teclado abra.
  const actionsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusCenterAndShowActions = (_e: React.FocusEvent<HTMLElement>) => {
    setTimeout(() => {
      if (actionsRef.current && contentRef.current) {
        const container = contentRef.current;
        const target = actionsRef.current;
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const scrollBy = targetRect.bottom - containerRect.bottom + 16;
        if (scrollBy > 0) {
          container.scrollBy({ top: scrollBy, behavior: "smooth" });
        }
      }
    }, 420);
  };

  // Formato de monto: permite dígitos y un punto decimal, con separadores de miles
  const formatWithCommas = (raw: string): string => {
    const parts = raw.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) {
      setAmountDisplay(formatWithCommas(raw));
      const num = parseFloat(raw);
      setAmount(isNaN(num) ? 0 : num);
    }
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = amountDisplay.replace(/,/g, "");
    setAmountDisplay(raw === "0.00" ? "" : raw);
    focusCenter(e);
  };

  const handleAmountBlur = () => {
    const raw = amountDisplay.replace(/,/g, "");
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      setAmountDisplay(num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      setAmountDisplay("");
      setAmount(0);
    }
  };

  const hasChanges =
    type !== tx.type ||
    amount !== tx.amount ||
    description !== tx.description ||
    categoryId !== tx.categoryId ||
    date !== tx.date ||
    (notes ?? "") !== (tx.notes ?? "");

  return (
    <div
      className="fixed z-50 flex items-center justify-center px-5"
      style={{ top: 0, left: 0, right: 0, bottom: 0, height: "100dvh", width: "100vw" }}
      onClick={onClose}
    >
      <div
        className="bg-black/70 animate-in fade-in-0 duration-200"
        style={{ position: "fixed", top: "-10vh", left: "-10vw", right: "-10vw", bottom: "-10vh", width: "120vw", height: "120dvh" }}
      />
      <div
        className="relative w-full max-w-sm bg-background rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden"
        style={{ willChange: "transform, opacity", transform: "translate3d(0,0,0)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — toggle liquid glass + close */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 shrink-0">
          <div
            className="relative flex items-center p-1 rounded-full flex-1"
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
                transform: isIncome ? "translateX(100%)" : "translateX(0%)",
                background: isIncome
                  ? "linear-gradient(135deg, rgba(29,185,84,0.95), rgba(29,185,84,0.75))"
                  : "linear-gradient(135deg, rgba(255,59,59,0.95), rgba(255,59,59,0.75))",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.18)",
              }}
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setType("expense")}
              className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors duration-300 rounded-full", !isIncome ? "text-white" : "text-foreground/50")}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Expense
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setType("income")}
              className={cn("relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors duration-300 rounded-full", isIncome ? "text-white" : "text-foreground/50")}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Income
            </button>
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 transition-all active:scale-95">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Zona del formulario — scroll interno, el header permanece fijo */}
        <div ref={contentRef} className="px-5 pb-5 space-y-4 overflow-y-auto" style={{ maxHeight: "min(70vh, 70dvh)" }}>
          {/* Monto — liquid glass premium con subrayado indicador */}
          <div className="flex flex-col items-center py-2">
            <div
              className="flex items-center gap-1.5 px-6 py-3 rounded-2xl"
              style={{
                backdropFilter: "blur(24px) saturate(1.6)",
                WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                background: isIncome
                  ? "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(29,185,84,0.06))"
                  : "linear-gradient(135deg, rgba(255,59,59,0.18), rgba(255,59,59,0.06))",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -1px 1px rgba(0,0,0,0.06)",
              }}
            >
              <span className="text-2xl font-bold" style={{ color: accentColor }}>{symbol}</span>
              <input
                type="text"
                inputMode="decimal"
                value={amountDisplay}
                onChange={handleAmountChange}
                onFocus={handleAmountFocus}
                onBlur={handleAmountBlur}
                placeholder="0.00"
                className="bg-transparent text-center text-4xl font-black tracking-tight border-0 outline-none focus:ring-0 p-0 shadow-none w-36"
                style={{ color: accentColor, fontFeatureSettings: "'tnum' on, 'lnum' on", caretColor: accentColor }}
              />
            </div>
            {/* Underline indicator — sugiere que es editable */}
            <div className="h-0.5 w-20 rounded-full mt-2.5" style={{ background: accentColor, opacity: 0.4 }} />

            <span className="text-[10px] font-semibold text-muted-foreground/50 mt-2.5 flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {formatDate(date)}
            </span>
          </div>

          {/* Categoría */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1 px-0.5">
              <FolderPlus className="h-2.5 w-2.5" />
              Category
            </label>
            {categoryOpen && (
              <div
                className="fixed inset-0 z-[55]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  justClosedRef.current = true;
                  setCategoryOpen(false);
                  setTimeout(() => { justClosedRef.current = false; }, 300);
                }}
              />
            )}
            <Select
              value={categoryId?.toString() ?? ""}
              onValueChange={v => setCategoryIdForType(Number(v))}
              open={categoryOpen}
              onOpenChange={setCategoryOpen}
            >
              <SelectTrigger
                onClick={() => { if (!justClosedRef.current) setCategoryOpen(v => !v); }}
                className="h-10 text-xs bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] rounded-2xl px-3 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all"
              >
                <SelectValue placeholder="Select category...">
                  {categoryId && (() => {
                    const cat = categories.find(c => c.id === categoryId);
                    if (!cat) return "Select category...";
                    return (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: cat.color }} />
                        <span className="font-bold text-foreground text-xs">{cat.name}</span>
                      </div>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border shadow-xl bg-background">
                {filteredCategories.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()} className="rounded-2xl text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1 px-0.5">
              <Pencil className="h-2.5 w-2.5" />
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onFocus={focusCenter}
              placeholder="What was this for?"
              className="w-full text-sm font-semibold bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl px-3 py-2.5 border border-black/[0.06] dark:border-white/[0.06] outline-none text-foreground placeholder:text-muted-foreground/40 focus:border-border/60 focus:bg-transparent transition-all"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1 px-0.5">
              <span>📝</span>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onFocus={focusCenterAndShowActions}
              placeholder="Add extra details here..."
              className="w-full text-sm font-semibold bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl px-3 py-2.5 border border-black/[0.06] dark:border-white/[0.06] outline-none text-foreground placeholder:text-muted-foreground/40 focus:border-border/60 focus:bg-transparent transition-all resize-none"
              rows={2}
            />
          </div>

          {/* Acciones — flujo normal, sin gap extra */}
          <div ref={actionsRef} className="flex gap-3 pt-1">
            <button onClick={() => setConfirmDelete(true)} disabled={isSaving}
              className="px-5 py-3 rounded-full bg-red-500/10 hover:bg-red-500/15 text-red-500 dark:text-red-400 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 border-0 flex items-center justify-center gap-1.5 shadow-none">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button onClick={handleSave} disabled={isSaving || !categoryId || !hasChanges}
              className="flex-1 py-3 rounded-full bg-[#A8FF3E] hover:bg-[#9bfe32] text-black text-sm font-black border-0 flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-none disabled:opacity-50">
              {isSaving ? <Skeleton className="h-4 w-4 rounded-full bg-black/20 animate-pulse" /> : <Check className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de confirmación */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" onClick={() => setConfirmDelete(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-background border border-border/60 shadow-xl rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Delete Record?</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 rounded-2xl bg-muted text-foreground text-xs font-semibold border border-border/60 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-1.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TransactionList — extracto bancario colapsable ──────────────────────────
function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function TransactionList({
  filteredTransactions,
  isLoading,
  formatAmount,
  onSelect,
}: {
  filteredTransactions: any[];
  isLoading: boolean;
  formatAmount: (n: number) => string;
  onSelect: (tx: any) => void;
}) {
  if (isLoading) return (
    <div className="space-y-2.5 px-1 pt-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn("flex", i % 3 === 1 ? "justify-end" : "justify-start")}>
          <Skeleton className="h-16 rounded-2xl" style={{ width: `${62 + (i % 3) * 8}%` }} />
        </div>
      ))}
    </div>
  );

  if (!filteredTransactions?.length) return (
    <div className="bg-card rounded-3xl shadow-sm p-12 flex flex-col items-center justify-center text-muted-foreground">
      <Search className="h-10 w-10 mb-3 opacity-30" />
      <p className="font-semibold">It's quiet in here</p>
      <p className="text-sm mt-1 text-center">Your money hasn't said anything yet. Add a transaction to start the conversation.</p>
    </div>
  );

  // Orden descendente y feed con marcadores de mes y dia
  const sorted = [...filteredTransactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  );

  const toKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const now = new Date();
  const todayKey = toKey(now);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const yesterdayKey = toKey(yest);

  const dayLabel = (date: string) => {
    if (date === todayKey) return "Today";
    if (date === yesterdayKey) return "Yesterday";
    return new Date(`${date}T00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  type FeedItem =
    | { kind: "month"; key: string; label: string; net: number }
    | { kind: "day"; key: string; label: string }
    | { kind: "tx"; key: string; tx: any };

  const feed: FeedItem[] = [];
  let lastMonth = "";
  let lastDay = "";
  for (const tx of sorted) {
    const month = tx.date.slice(0, 7);
    if (month !== lastMonth) {
      const net = sorted
        .filter((t) => t.date.slice(0, 7) === month)
        .reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0);
      feed.push({
        kind: "month",
        key: `m-${month}`,
        label: new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1)
          .toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        net,
      });
      lastMonth = month;
      lastDay = "";
    }
    if (tx.date !== lastDay) {
      feed.push({ kind: "day", key: `d-${tx.date}`, label: dayLabel(tx.date) });
      lastDay = tx.date;
    }
    feed.push({ kind: "tx", key: `t-${tx.id}`, tx });
  }

  return (
    <div className="space-y-2 px-0.5 pb-2">
      {feed.map((item, idx) => {
        if (item.kind === "month") {
          return (
            <div key={item.key} className="flex justify-center pt-4 pb-1">
              <span className="px-3.5 py-1.5 rounded-full bg-card shadow-sm flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">{item.label}</span>
                <span
                  className="text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md"
                  style={{
                    background: item.net >= 0 ? "rgba(29,185,84,0.14)" : "rgba(255,59,59,0.12)",
                    color: item.net >= 0 ? "#15803D" : "#B91C1C",
                  }}
                >
                  {item.net >= 0 ? "+" : "−"}{formatAmount(Math.abs(item.net))}
                </span>
              </span>
            </div>
          );
        }
        if (item.kind === "day") {
          return (
            <div key={item.key} className="flex justify-center py-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{item.label}</span>
            </div>
          );
        }
        const tx = item.tx;
        const inc = tx.type === "income";
        return (
          <div key={item.key} className={cn("flex", inc ? "justify-end" : "justify-start")}>
            <button
              onClick={() => onSelect(tx)}
              data-testid={`row-transaction-${tx.id}`}
              className={cn(
                "max-w-[82%] min-w-[58%] text-left rounded-2xl px-3.5 py-2.5 active:scale-[0.98] transition-transform animate-in fade-in slide-in-from-bottom-1 duration-200",
                inc ? "rounded-br-md" : "rounded-bl-md"
              )}
              style={{
                background: `${tx.categoryColor}21`,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                animationDelay: `${(idx % 12) * 20}ms`,
                animationFillMode: "backwards",
              }}
            >
              <p className="text-sm font-bold text-foreground leading-tight">{tx.description}</p>
              <div className="flex items-end justify-between gap-3 mt-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tx.categoryColor }}>
                  {tx.categoryName}
                </span>
                <span
                  className={cn(
                    "text-base font-black tabular-nums leading-none",
                    inc ? "text-[#1DB954] dark:text-[#39D96B]" : "text-[#FF3B3B] dark:text-[#FF5C5C]"
                  )}
                >
                  {inc ? "+" : "−"}{formatAmount(tx.amount)}
                </span>
              </div>
            </button>
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

  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const handleTypeChange = (val: string) => {
    setFilterType(val);
    setFilterCategory("all");
  };

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

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold tracking-tight text-foreground pr-14 min-h-10 flex items-center">Transactions</h2>

      {/* Mes + Categoria — anchos completos, textos enteros */}
      <div className="flex gap-2 items-center">
      <MonthSelect value={filterMonth} onChange={setFilterMonth} variant="neutral" placeholder="All time" className="flex-1" />
      <Select value={filterCategory} onValueChange={setFilterCategory}>
        <SelectTrigger className="h-10 text-sm bg-card shadow-sm border-0 rounded-2xl px-3 [&>span]:truncate">
          <SelectValue placeholder="All Categories" />
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
      {hasFilters && (
        <button
          onClick={resetFilters}
          className="h-10 w-10 rounded-2xl bg-card shadow-sm flex items-center justify-center shrink-0"
          title="Reset filters"
        >
          <FilterX className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
      </div>

      <Link href="/transactions/new" className="inline-flex w-full">
        <Button className="w-full gap-2 bg-[#A8FF3E] text-black hover:bg-[#9bfe32] border-0 font-bold" data-testid="button-add-transaction">
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </Link>

      {/* Transaction list — extracto bancario colapsable */}
      <TransactionList
        filteredTransactions={filteredTransactions}
        isLoading={isLoading}
        formatAmount={formatAmount}
        onSelect={setSelectedTx}
      />

      {/* Detail / Edit modal */}
      {selectedTx && Array.isArray(categories) && (
        <TransactionModal
          tx={selectedTx}
          categories={categories}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}