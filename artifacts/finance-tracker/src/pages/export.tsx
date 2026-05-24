import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, DatabaseZap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MonthSelect from "@/components/month-select";
import { getApiUrl } from "@/lib/api-config";

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const day = new Date(y, m, 0).getDate();
  return `${ym}-${String(day).padStart(2, "0")}`;
}

export default function Export() {
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

      const response = await fetch(getApiUrl(`api/export/excel${queryStr}`));
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance_export_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Export successful", description: "Your file is downloading." });
    } catch {
      toast({ title: "Export failed", description: "There was a problem generating your export.", variant: "destructive" });
    } finally {
      all ? setIsExportingAll(false) : setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-serif font-bold tracking-tight">Export Data</h2>
        <p className="text-muted-foreground mt-1">Download your transactions for your records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Excel Export
          </CardTitle>
          <CardDescription>
            Download all your transactions, or filter by a specific month range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From (Optional)</Label>
              <MonthSelect value={startMonth} onChange={setStartMonth} variant="neutral" />
            </div>
            <div className="space-y-2">
              <Label>To (Optional)</Label>
              <MonthSelect value={endMonth} onChange={setEndMonth} variant="neutral" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => doExport(true)}
            disabled={isExportingAll || isExporting}
            className="gap-2 sm:w-auto w-full"
            data-testid="button-download-all"
          >
            <DatabaseZap className="h-4 w-4" />
            {isExportingAll ? "Generating…" : "Download All Data"}
          </Button>
          <Button
            onClick={() => doExport(false)}
            disabled={isExporting || isExportingAll}
            className="gap-2 sm:w-auto w-full"
            data-testid="button-download-excel"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Generating…" : "Download Selected Range"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
