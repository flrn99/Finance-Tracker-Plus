import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface MonthSelectProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  className?: string;
}

export default function MonthSelect({ value, onChange, onBlur, className }: MonthSelectProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [yearStr, monthStr] = value ? value.split("-") : [String(currentYear), String(currentMonth).padStart(2, "0")];
  const selectedYear = parseInt(yearStr || String(currentYear));
  const selectedMonth = parseInt(monthStr || "1");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleMonth = (m: string) => {
    onChange(`${selectedYear}-${m.padStart(2, "0")}`);
    onBlur?.();
  };

  const handleYear = (y: string) => {
    const newYear = parseInt(y);
    const clampedMonth = newYear === currentYear
      ? Math.min(selectedMonth, currentMonth)
      : selectedMonth;
    onChange(`${y}-${String(clampedMonth).padStart(2, "0")}`);
    onBlur?.();
  };

  return (
    <div className={`grid grid-cols-2 gap-2 ${className ?? ""}`}>
      <Select value={String(selectedMonth)} onValueChange={handleMonth}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((label, idx) => {
            const monthNum = idx + 1;
            const isFuture = selectedYear === currentYear && monthNum > currentMonth;
            return (
              <SelectItem key={idx} value={String(monthNum)} disabled={isFuture}>
                {label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Select value={String(selectedYear)} onValueChange={handleYear}>
        <SelectTrigger className="h-10 w-full">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
