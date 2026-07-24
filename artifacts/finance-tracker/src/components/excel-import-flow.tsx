import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetSpendingByCategoryQueryKey,
  getGetMonthlyTrendQueryKey,
  getGetTopExpensesQueryKey,
} from "@workspace/api-client-react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImportReview from "@/components/import-review";

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

type Step = "upload" | "mapping" | "review";

const FILE_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

function parseAmount(raw: string): number {
  const s = (raw ?? "").trim();
  if (!s) return 0;
  const negative = s.includes("-") || (s.startsWith("(") && s.endsWith(")"));
  let cleaned = s.replace(/[^\d.,]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  // El último separador que aparece es el decimal — soporta "1,234.56" y "1.234,56"
  if (lastComma > lastDot) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");
  const num = parseFloat(cleaned) || 0;
  return negative ? -Math.abs(num) : Math.abs(num);
}

function parseDate(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY — asume formato local (GT), no US
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Último intento: Date() nativo entiende bien números y nombres de mes en
  // inglés, pero NO nombres de mes en otros idiomas (ej. "23 janvier 2026").
  // Si falla, mejor devolver vacío y que la fila se excluya en vez de dejar
  // pasar una fecha corrompida — el date no es editable en la preview, así
  // que un string sin parsear ahí rompería silenciosamente el orden/rango de
  // la transacción en el resto de la app.
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function inferType(rawType: string | undefined, amount: number): "income" | "expense" {
  const t = (rawType ?? "").toLowerCase().trim();
  if (/income|ingreso|credit|cr[eé]dito|dep[oó]sito|deposit/.test(t)) return "income";
  if (/expense|gasto|debit|d[eé]bito|egreso/.test(t)) return "expense";
  return amount < 0 ? "expense" : "income";
}

export default function ExcelImportFlow({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  const [dateCol, setDateCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [descriptionCol, setDescriptionCol] = useState("");
  const [typeCol, setTypeCol] = useState("__none__");

  const [isCategorizing, setIsCategorizing] = useState(false);
  const [editableTxs, setEditableTxs] = useState<EditableTx[] | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["excel-import-categories", session?.user?.id],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/categories"), {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  const handleUpload = async () => {
    try {
      setError(null);
      if (!Capacitor.isNativePlatform()) { setError("Import is only available on the mobile app"); return; }

      const result = await FilePicker.pickFiles({ types: FILE_TYPES, readData: true, limit: 1 });
      const file = result.files[0];
      if (!file?.data) { setError("Could not read file"); return; }

      const byteChars = atob(file.data);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr]);

      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", blob, file.name || "import.xlsx");

      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", getApiUrl("/api/import/excel/parse"));
        xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid response")); }
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed")); }
            catch { reject(new Error("Upload failed")); }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });

      if (!data.rows || data.rows.length === 0) { setError("No rows found in file"); return; }

      setHeaders(data.headers);
      setRawRows(data.rows);

      // Auto-match de columnas comunes por nombre — evita forzar el mapeo a
      // mano cuando el excel ya trae encabezados obvios (Fecha/Date, etc).
      const findCol = (pattern: RegExp) => {
        const idx = data.headers.findIndex((h: string) => pattern.test(h.toLowerCase()));
        return idx >= 0 ? String(idx) : "";
      };
      setDateCol(findCol(/fecha|date/));
      setAmountCol(findCol(/monto|amount|total|valor/));
      setDescriptionCol(findCol(/descrip|concepto|detalle|description/));
      setTypeCol(findCol(/tipo|type/) || "__none__");

      setStep("mapping");
    } catch (e: any) {
      if (!e.message?.includes("cancel")) setError(e.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Recalcula en vivo con cada cambio de columna — así el usuario VE si la
  // fecha/monto se leyeron bien antes de seguir, en vez de que el sistema
  // adivine el idioma/formato del excel por él (ver parseDate: una fecha que
  // no se puede leer con confianza se excluye, no se corrompe en silencio).
  const columnsMapped = !!dateCol && !!amountCol && !!descriptionCol;
  const mappedRows = useMemo(() => {
    if (!columnsMapped) return [];
    const dIdx = Number(dateCol);
    const aIdx = Number(amountCol);
    const descIdx = Number(descriptionCol);
    const tIdx = typeCol !== "__none__" ? Number(typeCol) : -1;

    return rawRows
      .map((row, index) => {
        const amount = parseAmount(row[aIdx]);
        const type = inferType(tIdx >= 0 ? row[tIdx] : undefined, amount);
        return {
          index,
          date: parseDate(row[dIdx]),
          amount: Math.abs(amount),
          type,
          description: row[descIdx]?.trim() || "(no description)",
        };
      })
      .filter((r) => r.date && r.amount > 0);
  }, [rawRows, columnsMapped, dateCol, amountCol, descriptionCol, typeCol]);

  const skippedCount = columnsMapped ? rawRows.length - mappedRows.length : 0;

  const handleContinueToReview = async () => {
    if (!columnsMapped) {
      setError("Please map Date, Amount and Description columns");
      return;
    }
    const rows = mappedRows;
    if (rows.length === 0) { setError("No valid rows after mapping"); return; }

    setIsCategorizing(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/import/excel/categorize"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Categorization failed");
      const data = await res.json();
      const results: any[] = data.results || [];
      const resultByIndex = new Map(results.map((r) => [r.index, r]));

      const txs: EditableTx[] = rows.map((r) => {
        const match = resultByIndex.get(r.index);
        return {
          date: r.date,
          description: r.description,
          amount: r.amount,
          type: r.type,
          categoryId: match?.categoryId ?? null,
          selected: true,
          isDuplicate: match?.isDuplicate ?? false,
          duplicateOf: match?.duplicateOf,
        };
      });

      setEditableTxs(txs);
      setStep("review");
    } catch (e: any) {
      setError(e.message || "Failed to prepare preview");
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleBulkSave = async (selected: EditableTx[]) => {
    const res = await fetch(getApiUrl("/api/transactions/bulk"), {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transactions: selected.map((tx) => ({
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          categoryId: tx.categoryId,
          notes: "Imported from spreadsheet",
        })),
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Import failed");
    const data = await res.json();
    return { success: data.created ?? 0 };
  };

  if (step === "review" && editableTxs) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <ImportReview
          transactions={editableTxs}
          categories={categories}
          onSave={handleBulkSave}
          onDone={() => {
            toast({ title: "Transactions imported successfully!", variant: "celebration" });
            queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({}) });
            queryClient.invalidateQueries({ queryKey: getGetSpendingByCategoryQueryKey({}) });
            queryClient.invalidateQueries({ queryKey: getGetMonthlyTrendQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetTopExpensesQueryKey({ limit: 5 }) });
            queryClient.invalidateQueries({ queryKey: ["insights-anomaly"] });
            queryClient.invalidateQueries({ queryKey: ["insights-fixed-vs-flexible"] });
            queryClient.invalidateQueries({ queryKey: ["insights-income-summary"] });
            onClose();
          }}
          onCancel={() => { setEditableTxs(null); setStep("mapping"); }}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="px-5 py-5 max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-muted shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="font-display text-xl">Import old transactions</h2>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl bg-destructive/10 text-destructive text-xs px-3 py-2.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "upload" && (
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-[#00A870]/15 flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-7 w-7 text-[#00593C] dark:text-[#6EE7B7]" />
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">
              Bring in transactions from a spreadsheet (.xlsx, .xls or .csv) so you don't lose your history.
            </p>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full py-3.5 rounded-2xl text-black text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
              }}
            >
              {isUploading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploadProgress}%</>
                : <><Upload className="h-4 w-4" /> Choose file</>}
            </button>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Match your spreadsheet's columns — {rawRows.length} rows found.
            </p>

            {[
              { label: "Date", value: dateCol, setValue: setDateCol },
              { label: "Amount", value: amountCol, setValue: setAmountCol },
              { label: "Description", value: descriptionCol, setValue: setDescriptionCol },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-xs font-semibold text-foreground mb-1.5">{field.label}</p>
                <Select value={field.value} onValueChange={field.setValue}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Type (optional)</p>
              <Select value={typeCol} onValueChange={setTypeCol}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Infer from amount</SelectItem>
                  {headers.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {columnsMapped && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">
                  Preview {mappedRows.length > 0 && `(first ${Math.min(5, mappedRows.length)} of ${mappedRows.length})`}
                </p>
                {mappedRows.length === 0 ? (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-2xl px-3 py-2.5">
                    Couldn't read any valid rows with these columns — double-check Date and Amount.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {mappedRows.slice(0, 5).map((r) => (
                      <div key={r.index} className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 text-xs">
                        <span className="text-muted-foreground shrink-0 w-[74px]">{r.date}</span>
                        <span className="flex-1 min-w-0 truncate text-foreground">{r.description}</span>
                        <span className={cn("font-semibold shrink-0", r.type === "income" ? "text-income" : "text-expense")}>
                          {r.type === "income" ? "+" : "-"}{r.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {skippedCount > 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                    {skippedCount} row{skippedCount !== 1 ? "s" : ""} skipped — couldn't read a valid date or amount for {skippedCount !== 1 ? "them" : "it"}.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleContinueToReview}
              disabled={isCategorizing || mappedRows.length === 0}
              className="w-full py-3.5 rounded-2xl text-black text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{
                background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
              }}
            >
              {isCategorizing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing preview...</>
                : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
