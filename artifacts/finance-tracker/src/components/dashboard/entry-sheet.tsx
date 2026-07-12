import { useEffect, useMemo, useRef, useState } from "react";
import { X, Delete, Check, FolderPlus, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import {
  useCreateTransaction,
  useListCategories,
  getListCategoriesQueryKey,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetMonthlyTrendQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type EntryType = "expense" | "income";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

export function EntrySheet({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { type?: EntryType; amount?: number; categoryId?: number; note?: string } | null;
}) {
  const { symbol } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTx = useCreateTransaction();

  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });

  const [type, setType] = useState<EntryType>("expense");
  const [raw, setRaw] = useState("0");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const isExpense = type === "expense";

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && isExpense) { setType("income"); setCategoryId(null); }
    else if (dx > 0 && !isExpense) { setType("expense"); setCategoryId(null); }
  }

  const filteredCategories = Array.isArray(categories)
    ? categories.filter((c: any) => c.type === type || c.type === "both")
    : [];

  // Reset / prefill on open
  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? "expense");
    setRaw(initial?.amount ? String(initial.amount) : "0");
    setCategoryId(initial?.categoryId ?? null);
    setNote(initial?.note ?? "");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const numeric = useMemo(() => Number.parseFloat(raw || "0") || 0, [raw]);

  const display = useMemo(() => {
    const [int, dec] = raw.split(".");
    const grouped = Number(int || "0").toLocaleString("en-US");
    return dec !== undefined ? `${grouped}.${dec.slice(0, 2)}` : grouped;
  }, [raw]);

  function press(key: string) {
    if (key === "del") { setRaw((r) => (r.length <= 1 ? "0" : r.slice(0, -1))); return; }
    if (key === ".") { setRaw((r) => (r.includes(".") ? r : r + ".")); return; }
    setRaw((r) => {
      if (r === "0") return key;
      if (r.includes(".") && (r.split(".")[1]?.length ?? 0) >= 2) return r;
      return r + key;
    });
  }

  const selectedCategory = filteredCategories.find((c: any) => c.id === categoryId);
  const canSubmit = numeric > 0 && !!categoryId && !createTx.isPending;

  function submit() {
    if (!canSubmit || !categoryId) return;
    const date = new Date().toISOString().slice(0, 7) + "-01";
    createTx.mutate(
      { data: { type, amount: numeric, description: note.trim() || selectedCategory?.name || "—", categoryId, date } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
          toast({ title: `${isExpense ? "Expense" : "Income"} added` });
          onClose();
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center" style={{ background: "rgba(2,2,3,0.3)", backdropFilter: "blur(4px)" }} role="dialog" aria-modal="true">
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-background duration-300 animate-in slide-in-from-bottom-8"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 pb-2 pt-5">
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>

          {/* Toggle liquid glass */}
          <div
            className="relative flex items-center overflow-hidden rounded-full p-1 shrink-0"
            style={{
              backdropFilter: "blur(24px) saturate(1.6)",
              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              background: "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.12))",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.08)",
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
              onClick={() => { setType("expense"); setCategoryId(null); }}
              className={cn(
                "relative z-10 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors duration-300",
                isExpense ? "text-white" : "text-foreground/50"
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} />
              Expense
            </button>
            <button
              type="button"
              onClick={() => { setType("income"); setCategoryId(null); }}
              className={cn(
                "relative z-10 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors duration-300",
                !isExpense ? "text-white" : "text-foreground/50"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
              Income
            </button>
          </div>

          <div className="w-10" />
        </header>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-2">
          {/* Amount — hero pastel claro, misma familia que Insights */}
          <div
            className="relative overflow-hidden rounded-3xl px-5 pt-5 pb-6 transition-[background] duration-300"
            style={{
              background: isExpense
                ? "linear-gradient(145deg, #FFEDEE 0%, #FFD3D6 55%, #FFB0B5 100%)"
                : "linear-gradient(145deg, #E3FFF4 0%, #BFFFE3 55%, #8FFFCB 100%)",
            }}
          >
            {/* Blobs decorativos suaves */}
            <div className="absolute -top-14 -right-10 w-44 h-44 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.4)" }} />
            <div className="absolute -bottom-14 -left-8 w-36 h-36 rounded-full pointer-events-none" style={{ background: isExpense ? "rgba(255,77,77,0.12)" : "rgba(0,255,156,0.15)" }} />

            <div className="relative flex flex-col items-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: isExpense ? "rgba(127,29,29,0.6)" : "rgba(0,67,44,0.6)" }}>
                {isExpense ? "Money out" : "Money in"}
              </p>
              <div className="mt-2 flex items-start justify-center gap-1">
                <span className="mt-2 text-3xl font-bold" style={{ color: isExpense ? "#FF4D4D" : "#00A870" }}>{symbol}</span>
                <span className="font-serif text-[56px] font-bold leading-none tracking-tight tabular-nums"
                  style={{ color: numeric > 0 ? (isExpense ? "#7F1D1D" : "#00432C") : (isExpense ? "rgba(127,29,29,0.3)" : "rgba(0,67,44,0.3)") }}>
                  {display}
                </span>
              </div>
            </div>
          </div>

          {/* Category — dropdown */}
          <div className="mt-4">
            <Select value={categoryId ? String(categoryId) : ""} onValueChange={(v) => setCategoryId(Number(v))}>
              <SelectTrigger className="h-14 w-full rounded-2xl border-0 bg-muted px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  {selectedCategory ? (
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: selectedCategory.color }} />
                  ) : (
                    <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.25} />
                  )}
                  <SelectValue placeholder={isExpense ? "Where did it go?" : "Where from?"} />
                </div>
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.length === 0 ? (
                  <div className="px-1 py-2">
                    <Link href="/categories" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-sm text-primary transition-colors hover:bg-primary/10">
                        <FolderPlus className="h-4 w-4 shrink-0" />
                        Add a category
                      </button>
                    </Link>
                  </div>
                ) : (
                  filteredCategories.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…"
            className="mt-3 w-full rounded-2xl border-0 bg-muted px-4 py-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground" />

          {/* Keypad */}
          <div className="pb-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button key={k} type="button" onClick={() => press(k)}
                  className="flex h-14 items-center justify-center rounded-2xl bg-muted text-2xl font-semibold text-foreground transition-transform active:scale-95">
                  {k === "del" ? <Delete className="h-6 w-6" strokeWidth={2} /> : k}
                </button>
              ))}
            </div>

            <button type="button" disabled={!canSubmit} onClick={submit}
              className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors"
              style={{
                background: canSubmit ? (isExpense ? "#E11D48" : "#00593C") : "hsl(var(--muted))",
                color: canSubmit ? "#FFFFFF" : "hsl(var(--muted-foreground))",
                cursor: canSubmit ? "pointer" : "not-allowed",
                boxShadow: canSubmit ? "0 4px 14px rgba(0,0,0,0.2)" : "none",
              }}>
              <Check className="h-5 w-5" strokeWidth={2.5} />
              {canSubmit ? `Add ${isExpense ? "expense" : "income"}` : (createTx.isPending ? "Saving…" : "Enter amount & category")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
