import { useEffect, useMemo, useRef, useState } from "react";
import { X, Delete, Check, FolderPlus, TrendingUp, TrendingDown, Trash2, AlertTriangle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { App } from "@capacitor/app";
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
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
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type EntryType = "expense" | "income";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

// Mismo patrón que biometric-lock.tsx: cachea el módulo tras el primer import
// para que cada tecla no pague el overhead de una promesa nueva.
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

export function EntrySheet({
  open,
  onClose,
  initial,
  tx,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { type?: EntryType; amount?: number; categoryId?: number; note?: string } | null;
  /** Transacción completa a editar. Si viene seteada, la hoja entra en modo edit (PATCH + Delete) en vez de modo crear (POST). */
  tx?: { id: number; type: EntryType; amount: number; categoryId: number; description: string; date: string } | null;
}) {
  const { symbol } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() },
  });

  const [type, setType] = useState<EntryType>("expense");
  const [raw, setRaw] = useState("0");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isExpense = type === "expense";

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const deleteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const keyStartPos = useRef<{ x: number; y: number } | null>(null);
  // Evita doble disparo entre pointer events y el click sintético que le sigue,
  // pero deja pasar el click "puro" de Enter/Espacio por teclado (sin pointerdown antes).
  const firedByPointer = useRef(false);

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

  // El swipe expense/income de arriba escucha touch en toda la hoja — sin cortar la
  // propagación acá, arrastrar los dedos sobre las pills (sobre todo al pegar contra
  // el último/primer chip) también se cuenta como ese swipe y cambia el tipo solo.
  function handleCategoryTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
  }

  const catScrollRef = useRef<HTMLDivElement>(null);
  const [catFade, setCatFade] = useState({ left: false, right: false });

  function updateCatFade() {
    const el = catScrollRef.current;
    if (!el) return;
    setCatFade({
      left: el.scrollLeft > 4,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
    });
  }

  const filteredCategories = Array.isArray(categories)
    ? categories.filter((c: any) => c.type === type || c.type === "both")
    : [];

  // La lista de pills cambia con el tipo (y el ancho de scroll con ella) — el fade
  // estático no reflejaba eso: quedaba prendido en el borde izquierdo aunque no
  // hubiera nada para atrás. Se recalcula cada vez que cambia la lista o se abre la hoja.
  useEffect(() => {
    updateCatFade();
  }, [filteredCategories.length, open]);

  // Reset / prefill on open — si hay tx, precarga para editar; si no, usa initial (voice-capture) o vacío
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (tx) {
      setType(tx.type);
      setRaw(String(tx.amount));
      setCategoryId(tx.categoryId);
      setNote(tx.description ?? "");
      return;
    }
    setType(initial?.type ?? "expense");
    setRaw(initial?.amount ? String(initial.amount) : "0");
    setCategoryId(initial?.categoryId ?? null);
    setNote(initial?.note ?? "");
  }, [open, initial, tx]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Back nativo de Android: cierra la hoja en vez de dejar que Android no haga nada o salga de la app
  useEffect(() => {
    if (!open) return;
    const handler = App.addListener("backButton", () => {
      onClose();
    });
    return () => { handler.then((h) => h.remove()); };
  }, [open]);

  // Corta el auto-repeat de borrar si la hoja se cierra a mitad de un hold
  useEffect(() => {
    if (!open) {
      if (deleteTimeout.current) { clearTimeout(deleteTimeout.current); deleteTimeout.current = null; }
      if (deleteInterval.current) { clearInterval(deleteInterval.current); deleteInterval.current = null; }
    }
  }, [open]);

  const numeric = useMemo(() => Number.parseFloat(raw || "0") || 0, [raw]);

  const display = useMemo(() => {
    const [int, dec] = raw.split(".");
    const grouped = Number(int || "0").toLocaleString("en-US");
    // Sin punto tecleado todavía (típico de un monto dictado por voz, ej. "25")
    // siempre se ve completo con los .00 — es lo que se va a guardar igual.
    return dec !== undefined ? `${grouped}.${dec.slice(0, 2)}` : `${grouped}.00`;
  }, [raw]);

  // Auto-achica el monto si el número es largo, para que nunca se corte —
  // el tamaño base (64px) es el que ya se aprobó para montos cortos.
  const amountFontSize = useMemo(() => {
    const len = display.length;
    if (len <= 6) return 64;
    if (len <= 8) return 56;
    if (len <= 10) return 46;
    return 38;
  }, [display]);

  function press(key: string) {
    triggerHaptic();
    if (key === "del") { setRaw((r) => (r.length <= 1 ? "0" : r.slice(0, -1))); return; }
    if (key === ".") { setRaw((r) => (r.includes(".") ? r : r + ".")); return; }
    setRaw((r) => {
      if (r === "0") return key;
      if (r.includes(".") && (r.split(".")[1]?.length ?? 0) >= 2) return r;
      return r + key;
    });
  }

  function startDeleteRepeat() {
    stopDeleteRepeat();
    deleteTimeout.current = setTimeout(() => {
      deleteInterval.current = setInterval(() => press("del"), 90);
    }, 450);
  }

  function stopDeleteRepeat() {
    if (deleteTimeout.current) { clearTimeout(deleteTimeout.current); deleteTimeout.current = null; }
    if (deleteInterval.current) { clearInterval(deleteInterval.current); deleteInterval.current = null; }
  }

  const selectedCategory = filteredCategories.find((c: any) => c.id === categoryId);

  const hasChanges = !tx || (
    type !== tx.type ||
    numeric !== tx.amount ||
    categoryId !== tx.categoryId ||
    note.trim() !== (tx.description ?? "").trim()
  );

  const canSubmit =
    numeric > 0 && !!categoryId && !createTx.isPending && !updateTx.isPending && hasChanges;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
  };

  function submit() {
    if (!canSubmit || !categoryId) return;
    const description = note.trim() || selectedCategory?.name || "—";

    if (tx) {
      updateTx.mutate(
        { id: tx.id, data: { type, amount: numeric, description, categoryId, date: tx.date } },
        {
          onSuccess: () => {
            invalidateAll();
            toast({ title: "Transaction updated" });
            onClose();
          },
          onError: () => toast({ title: "Failed to update transaction", variant: "destructive" }),
        }
      );
      return;
    }

    const date = new Date().toISOString().slice(0, 7) + "-01";
    createTx.mutate(
      { data: { type, amount: numeric, description, categoryId, date } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: `${isExpense ? "Expense" : "Income"} added` });
          onClose();
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    if (!tx) return;
    deleteTx.mutate(
      { id: tx.id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Transaction deleted" });
          onClose();
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
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

          {/* Toggle — flat, sin glass */}
          <div className="relative flex items-center rounded-full bg-muted p-1 shrink-0">
            <div
              className="absolute top-1 left-1 rounded-full transition-transform duration-300 ease-out"
              style={{
                bottom: "4px",
                width: "calc(50% - 4px)",
                transform: isExpense ? "translateX(0%)" : "translateX(100%)",
                background: isExpense ? "#FF4D4D" : "#00A870",
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
          {/* Amount — superficie neutra, el color vive solo en el monto (acento puntual) */}
          <div className="flex flex-col items-center py-5">
            <div className="flex items-baseline justify-center gap-1">
              <span
                className={cn(
                  "font-bold",
                  isExpense ? "text-[#E11D48] dark:text-[#FFA3A3]" : "text-[#00593C] dark:text-[#6EE7B7]"
                )}
                style={{ fontSize: amountFontSize * 0.45 }}
              >
                {symbol}
              </span>
              <span
                className={cn(
                  "font-entry-amount leading-none tracking-tight",
                  numeric > 0
                    ? isExpense
                      ? "text-[#E11D48] dark:text-[#FFA3A3]"
                      : "text-[#00593C] dark:text-[#6EE7B7]"
                    : "text-muted-foreground/40"
                )}
                style={{ fontSize: amountFontSize, transition: "font-size 150ms ease-out" }}
              >
                {display}
              </span>
            </div>
            {tx && (
              <span className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/50">
                <Calendar className="h-2.5 w-2.5" />
                {formatDate(tx.date)}
              </span>
            )}
          </div>

          {/* Category — fila de pills con scroll horizontal, quietas hasta seleccionar */}
          <div className="mt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {isExpense ? "Where did it go?" : "Where from?"}
            </p>
            <div
              ref={catScrollRef}
              onScroll={updateCatFade}
              onTouchStart={handleCategoryTouchStart}
              className="flex gap-1.5 overflow-x-auto pb-1"
              style={{
                WebkitMaskImage: `linear-gradient(to right, ${catFade.left ? "transparent 0, black 12px" : "black 0"}, ${catFade.right ? "black calc(100% - 20px), transparent 100%" : "black 100%"})`,
                maskImage: `linear-gradient(to right, ${catFade.left ? "transparent 0, black 12px" : "black 0"}, ${catFade.right ? "black calc(100% - 20px), transparent 100%" : "black 100%"})`,
                scrollbarWidth: "none",
              }}
            >
              {filteredCategories.map((c: any) => {
                const isSelected = categoryId === c.id;
                // Sin seleccionar: neutro con un puntito del color real como indicador.
                // Seleccionado: chip oscuro fijo + texto blanco — el color de categoría
                // vive solo en el check, no compite con el resto de la fila.
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors"
                    style={{
                      background: isSelected ? "#14140F" : "hsl(var(--muted))",
                      color: isSelected ? "#FFFFFF" : "hsl(var(--foreground))",
                    }}
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3 shrink-0" strokeWidth={3} style={{ color: c.color }} />
                    ) : (
                      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: c.color }} />
                    )}
                    {c.name}
                  </button>
                );
              })}
              <Link href="/categories" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-border px-3.5 py-2 text-[13px] font-bold text-muted-foreground"
                >
                  <FolderPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Add
                </button>
              </Link>
            </div>
          </div>

          {/* Note */}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…"
            className="mt-3 w-full rounded-2xl border-0 bg-muted px-4 py-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground" />

          {/* Keypad — mismo flujo que el resto, sin separarlo en su propio contenedor */}
          <div className="pb-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}>
            <div className="mx-auto grid max-w-[228px] grid-cols-3 items-center gap-0.5">
              {KEYS.map((k) => {
                const isZero = k === "0";
                const isDot = k === ".";
                const isDel = k === "del";
                const isPressed = pressedKey === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-label={isDel ? "Delete" : isDot ? "Decimal point" : k}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setPressedKey(k);
                      if (isDel) {
                        // Borrar sigue disparando al toque, para que el hold-to-delete funcione
                        firedByPointer.current = true;
                        press(k);
                        startDeleteRepeat();
                      } else {
                        // Dígitos/punto: guardamos la posición, se confirma recién en pointerUp
                        keyStartPos.current = { x: e.clientX, y: e.clientY };
                      }
                    }}
                    onPointerUp={(e) => {
                      setPressedKey(null);
                      if (isDel) { stopDeleteRepeat(); return; }
                      const start = keyStartPos.current;
                      keyStartPos.current = null;
                      if (!start) return;
                      const dx = Math.abs(e.clientX - start.x);
                      const dy = Math.abs(e.clientY - start.y);
                      if (dx > 12 || dy > 12) return; // fue un swipe que pasó por encima, no una tocada real
                      firedByPointer.current = true;
                      press(k);
                    }}
                    onClick={() => {
                      // Camino de teclado (Enter/Espacio) — no hubo pointer events antes de esto
                      if (firedByPointer.current) { firedByPointer.current = false; return; }
                      press(k);
                    }}
                    onPointerLeave={() => { setPressedKey(null); if (isDel) stopDeleteRepeat(); }}
                    onPointerCancel={() => { setPressedKey(null); if (isDel) stopDeleteRepeat(); }}
                    className={cn(
                      "justify-self-center flex items-center justify-center rounded-full font-sans font-semibold leading-none text-foreground",
                      isZero ? "h-[70px] w-[70px] text-5xl" : "h-[58px] w-[58px] text-4xl"
                    )}
                    style={{
                      background: isPressed
                        ? isExpense ? "rgba(255,77,77,0.16)" : "rgba(0,168,112,0.18)"
                        : "transparent",
                      transform: isPressed ? "scale(0.92)" : "scale(1)",
                      transition: "background-color 180ms cubic-bezier(0.25, 1, 0.5, 1), transform 180ms cubic-bezier(0.25, 1, 0.5, 1)",
                    }}
                  >
                    {isDel ? (
                      <Delete
                        className={cn("h-6 w-6 opacity-60", isExpense ? "text-[#E11D48]" : "text-[#00593C]")}
                        strokeWidth={2}
                      />
                    ) : isDot ? (
                      <span
                        className="h-[11px] w-[11px] rounded-full"
                        style={{ background: isExpense ? "#FF4D4D" : "#00FF9C" }}
                      />
                    ) : (
                      k
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              {tx && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete transaction"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted transition-transform active:scale-95"
                >
                  <Trash2 className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                </button>
              )}
              <button type="button" disabled={!canSubmit} onClick={submit}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold transition-colors"
                style={{
                  background: canSubmit ? (isExpense ? "#E11D48" : "#00593C") : "hsl(var(--muted))",
                  color: canSubmit ? "#FFFFFF" : "hsl(var(--muted-foreground))",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  boxShadow: canSubmit ? "0 4px 14px rgba(0,0,0,0.2)" : "none",
                }}>
                <Check className="h-5 w-5" strokeWidth={2.5} />
                {canSubmit
                  ? (tx ? "Save changes" : `Add ${isExpense ? "expense" : "income"}`)
                  : (createTx.isPending || updateTx.isPending)
                    ? "Saving…"
                    : (tx && !hasChanges ? "No changes to save" : "Enter amount & category")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmación de borrado — decisión binaria, se resuelve con un popup chico, no con otra hoja */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          onClick={() => setConfirmDelete(false)}
          role="alertdialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs animate-in fade-in slide-in-from-bottom-4 rounded-2xl border border-border/60 bg-background p-5 shadow-xl duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E11D48]/10">
                <AlertTriangle className="h-4 w-4 text-[#E11D48]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Delete record?</h4>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-2xl border border-border/60 bg-muted py-1.5 text-xs font-semibold text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-2xl bg-[#E11D48] py-1.5 text-xs font-bold text-white transition-colors hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
