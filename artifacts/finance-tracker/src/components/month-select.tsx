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
  size?: "sm" | "lg";
  placeholder?: string;
}

export default function MonthSelect({
  value, onChange, onBlur, className, variant = "income", size = "sm", placeholder
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

  const heightCls = size === "lg" ? "h-12" : "h-10";

  const glassStyle =
    variant === "expense"
      ? {
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          background: "linear-gradient(135deg, rgba(255,59,59,0.22), rgba(255,59,59,0.08))",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.06)",
        }
      : variant === "income"
      ? {
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          background: "linear-gradient(135deg, rgba(29,185,84,0.22), rgba(29,185,84,0.08))",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.06)",
        }
      : undefined;

  const triggerCls =
    variant === "expense" || variant === "income"
      ? cn(heightCls, "w-full text-black dark:text-white font-semibold border-0 rounded-2xl transition-colors focus:ring-0")
      : cn(heightCls, "w-full bg-card border border-card-border rounded-2xl text-sm");

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Select
        value={selectedMonth !== undefined ? String(selectedMonth) : ""}
        onValueChange={handleMonth}
      >
        <SelectTrigger className={triggerCls} style={glassStyle}>
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
        <SelectTrigger className={triggerCls} style={glassStyle}>
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
