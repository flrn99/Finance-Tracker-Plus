import { useState } from "react";
import { ArrowLeft, Check, AlertTriangle, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency-context";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

interface EditableTx {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryId: number | null;
  selected: boolean;
  isDuplicate?: boolean;
  duplicateOf?: { id: number; date: string; amount: number; description: string };
}

interface ImportReviewProps {
  transactions: EditableTx[];
  categories: any[];
  onDone: () => void;
  onCancel: () => void;
  // Default: loop de POST /transactions uno por uno (comportamiento original,
  // usado por el import de PDF). El import de Excel pasa su propia
  // implementación que pega a /transactions/bulk.
  onSave?: (selected: EditableTx[]) => Promise<{ success: number }>;
}

function ConfirmModal({ message, onConfirm, onClose }: { message: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-card-border rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-sm text-foreground leading-relaxed pt-1.5">{message}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl bg-muted text-foreground text-sm font-semibold border-0">Cancel</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-2.5 rounded-2xl bg-destructive text-white text-sm font-semibold border-0">Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function ImportReview({ transactions: initial, categories, onDone, onCancel, onSave }: ImportReviewProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [txs, setTxs] = useState<EditableTx[]>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const updateTx = (i: number, field: keyof EditableTx, value: any) => {
    setTxs(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  const selectedCount = txs.filter(t => t.selected).length;
  const allSelected = txs.every(t => t.selected);

  const saveTransactions = async () => {
    const toImport = txs.filter(tx => tx.selected && tx.categoryId);
    if (toImport.length === 0) {
      toast({ title: "Nothing to import", description: "Select at least one transaction with a category.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let success = 0;
      if (onSave) {
        const result = await onSave(toImport);
        success = result.success;
      } else {
        for (const tx of toImport) {
          const res = await fetch(getApiUrl("/api/transactions"), {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ type: tx.type, amount: tx.amount, description: tx.description, date: tx.date, categoryId: tx.categoryId, notes: "Imported from bank statement" }),
          });
          if (res.ok) success++;
        }
      }
      toast({
        title: `${success} transaction${success !== 1 ? "s" : ""} imported`,
        description: success < toImport.length ? `${toImport.length - success} failed.` : "All saved successfully.",
        variant: "celebration",
      });
      onDone();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => selectedCount > 0 ? setConfirmCancel(true) : onCancel();

  const FOOTER_H = 80;

  return (
    <>
      {/* Scroll area */}
      <div
        className="overflow-y-auto animate-in fade-in duration-300"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: `calc(env(safe-area-inset-bottom) + ${FOOTER_H}px)`,
          paddingTop: "calc(env(safe-area-inset-top) + 16px)",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleCancel} className="w-9 h-9 flex items-center justify-center rounded-full bg-muted shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl">Review Transactions</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{selectedCount} of {txs.length} selected</p>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <button
                onClick={() => setTxs(prev => prev.map(t => ({ ...t, selected: !allSelected })))}
                className="text-xs text-sidebar-primary font-semibold"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
          </div>
        </div>

        {/* Transaction cards */}
        <div className="space-y-2 pb-4">
          {txs.map((tx, i) => (
            <div
              key={i}
              className={cn(
                "bg-card border border-card-border rounded-2xl px-3.5 py-3 transition-opacity",
                !tx.selected && "opacity-40"
              )}
            >
              {/* Fila superior: checkbox + descripción + monto */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => updateTx(i, "selected", !tx.selected)}
                  className={cn(
                    "w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-all",
                    tx.selected ? "bg-[#0ea5e9] border-[#0ea5e9]" : "border-border"
                  )}
                >
                  {tx.selected && <Check className="h-3 w-3 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  {editingIndex === i ? (
                    <input
                      type="text" autoFocus value={tx.description}
                      onChange={e => updateTx(i, "description", e.target.value)}
                      onBlur={() => setEditingIndex(null)}
                      className="w-full text-sm font-medium bg-muted rounded-2xl px-2 py-0.5 border-none outline-none text-foreground"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                      <button onClick={() => setEditingIndex(i)} className="shrink-0 text-muted-foreground/40">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{tx.date}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className={cn("text-sm font-bold", tx.type === "income" ? "text-income" : "text-expense")}>
                    {tx.type === "income" ? "+" : "-"}{formatAmount(tx.amount)}
                  </p>
                  <button
                    onClick={() => updateTx(i, "type", tx.type === "income" ? "expense" : "income")}
                    className="text-[11px] text-muted-foreground underline"
                  >
                    {tx.type}
                  </button>
                </div>
              </div>

              {tx.isDuplicate && (
                <div className="mt-1.5 pl-7 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>
                    Possible duplicate
                    {tx.duplicateOf && ` of "${tx.duplicateOf.description}" on ${tx.duplicateOf.date}`}
                  </span>
                </div>
              )}

              {/* Fila inferior: categoría */}
              <div className="mt-2 pl-7">
                <Select value={tx.categoryId?.toString() ?? ""} onValueChange={v => updateTx(i, "categoryId", Number(v))}>
                  <SelectTrigger className="h-8 text-xs bg-muted/50 border-0 rounded-2xl px-2.5">
                    <SelectValue placeholder="Select category...">
                      {tx.categoryId && (() => {
                        const cat = categories.find(c => c.id === tx.categoryId);
                        if (!cat) return "Select category...";
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span>{cat.name}</span>
                          </div>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.type === tx.type).map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />{c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer con fade */}
      <div
        className="fixed left-0 right-0 flex flex-col"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)", zIndex: 35 }}
      >
        <div
          className="w-full pointer-events-none"
          style={{ height: "48px", background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        />
        <div className="flex gap-2 px-4 pb-3 pt-1 bg-background">
          <button
            onClick={saveTransactions}
            disabled={isSaving || selectedCount === 0}
            className="flex-1 py-3 rounded-2xl bg-black text-white text-sm font-bold border-0 disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {isSaving ? "Importing..." : `Import ${selectedCount} selected`}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-5 py-3 rounded-2xl bg-red-500/10 text-red-500 dark:text-red-400 text-sm font-semibold border-0 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>

      {confirmCancel && (
        <ConfirmModal
          message={`You have ${selectedCount} transaction${selectedCount !== 1 ? "s" : ""} selected. Discard and go back?`}
          onConfirm={onCancel}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </>
  );
}
