import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Upload, FileSpreadsheet, DatabaseZap, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import MonthSelect from "@/components/month-select";
import { getApiUrl } from "@/lib/api-config";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import ExcelImportFlow from "@/components/excel-import-flow";

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${ym}-${String(day).padStart(2, "0")}`;
}

/**
 * Panel de export reutilizable — se usa tal cual en la página completa
 * y dentro del popup del menú de perfil. `onDone` se llama tras un export
 * exitoso (útil para cerrar el popup).
 */
export function ExportPanel({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);

  const doExport = async (all: boolean) => {
    all ? setIsExportingAll(true) : setIsExporting(true);
    try {
      let queryStr = "";
      if (!all) {
        const params = new URLSearchParams();
        if (startMonth) params.append("startDate", `${startMonth}-01`);
        if (endMonth) params.append("endDate", lastDayOfMonth(endMonth));
        if (params.toString()) queryStr = `?${params.toString()}`;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(getApiUrl(`api/export/excel${queryStr}`), {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const fileName = `finance_export_${new Date().toISOString().split("T")[0]}.xlsx`;

      if (Capacitor.isNativePlatform()) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents,
          });
          toast({ title: "Export saved", description: `Saved to Documents/${fileName}`, variant: "celebration" });
          onDone?.();
        };
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: "Export successful", description: "Your file is downloading.", variant: "celebration" });
        onDone?.();
      }
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      all ? setIsExportingAll(false) : setIsExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">Excel Export</p>
          <p className="text-xs text-muted-foreground mt-0.5">Filter by date range or download everything</p>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">From (Optional)</Label>
            <MonthSelect value={startMonth} onChange={setStartMonth} variant="neutral" className="w-full" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">To (Optional)</Label>
            <MonthSelect value={endMonth} onChange={setEndMonth} variant="neutral" className="w-full" />
          </div>
        </div>
      </div>

      <div className="border-t border-border px-5 py-4 flex flex-col sm:flex-row gap-3">
        <Button
          onClick={() => doExport(true)}
          disabled={isExportingAll || isExporting}
          className="gap-2 flex-1 text-black border-0 font-bold"
          style={{
            background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
          }}
          data-testid="button-download-excel"
        >
          <DatabaseZap className="h-4 w-4" />
          {isExportingAll ? "Generating…" : "Download All"}
        </Button>
        <Button
          onClick={() => doExport(false)}
          disabled={isExporting || isExportingAll}
          className="gap-2 flex-1 bg-[#0a0a0a] text-white hover:bg-[#1a1a1a] border-0 font-bold"
          data-testid="button-download-excel"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Generating…" : "Download Range"}
        </Button>
      </div>
    </div>
  );
}

export default function Export() {
  const [, navigate] = useLocation();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-500">
      {/* Flecha de regreso a settings */}
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Settings
      </button>

      <h2 className="text-3xl font-bold tracking-tight">Excel</h2>

      <ExportPanel />

      {/* Import — mismo flujo fullscreen (upload → mapeo → preview) que ya
          se ofrece en Onboarding, ahora también accesible acá para cuando el
          usuario no tenía el archivo a mano el día que se registró. */}
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">Excel Import</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bring transactions from a spreadsheet</p>
          </div>
        </div>
        <div className="border-t border-border px-5 py-4">
          <Button
            onClick={() => setImportOpen(true)}
            className="gap-2 w-full text-black border-0 font-bold"
            style={{
              background: "linear-gradient(135deg, #CAFA01 0%, #7CB518 100%)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 10px -2px rgba(124,181,24,0.45)",
            }}
          >
            <Upload className="h-4 w-4" />
            Choose File
          </Button>
        </div>
      </div>

      {importOpen && <ExcelImportFlow onClose={() => setImportOpen(false)} />}
    </div>
  );
}
