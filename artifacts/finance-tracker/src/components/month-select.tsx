import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface MonthSelectProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  className?: string;
  variant?: "income" | "expense" | "neutral";
  placeholder?: string;
}

export default function MonthSelect({
  value, onChange, onBlur, className, variant = "income", placeholder
}: MonthSelectProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isEmpty = !value;
  const [yearStr, monthStr] = value ? value.split("-") : [];
  const selectedYear = yearStr ? parseInt(yearStr) : undefined;
  const selectedMonth = monthStr ? parseInt(monthStr) : undefined;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleMonth = (m: string) => {
    const year = selectedYear ?? currentYear;
    onChange(`${year}-${m.padStart(2, "0")}`);
    onBlur?.();
  };

  const handleYear = (y: string) => {
    const newYear = parseInt(y);
    if (selectedMonth !== undefined) {
      const clampedMonth = newYear === currentYear
        ? Math.min(selectedMonth, currentMonth)
        : selectedMonth;
      onChange(`${y}-${String(clampedMonth).padStart(2, "0")}`);
    } else {
      onChange(`${y}-${String(currentMonth).padStart(2, "0")}`);
    }
    onBlur?.();
  };

  const triggerCls =
    variant === "expense"
      ? "h-10 w-full bg-expense/12 text-expense font-semibold border-0 rounded-xl hover:bg-expense/18 transition-colors focus:ring-1 focus:ring-expense/30"
      : variant === "income"
      ? "h-10 w-full bg-income/12 text-income font-semibold border-0 rounded-xl hover:bg-income/18 transition-colors focus:ring-1 focus:ring-income/30"
      : "h-10 w-full bg-background border border-input rounded-md text-sm";

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Select
        value={selectedMonth !== undefined ? String(selectedMonth) : ""}
        onValueChange={handleMonth}
      >
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder={isEmpty ? (placeholder ?? "Month") : "Month"} />
        </SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((label, idx) => {
            const monthNum = idx + 1;
            const isFuture = (selectedYear ?? currentYear) === currentYear && monthNum > currentMonth;
            return (
              <SelectItem key={idx} value={String(monthNum)} disabled={isFuture}>
                {label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select
        value={selectedYear !== undefined ? String(selectedYear) : ""}
        onValueChange={handleYear}
      >
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder={isEmpty ? (placeholder ?? "Year") : "Year"} />
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
