import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/lib/currency-context";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}

function formatWithCommas(raw: string): string {
  const parts = raw.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export default function CurrencyInput({ value, onChange, onBlur, placeholder = "0.00", className, testId }: CurrencyInputProps) {
  const { symbol } = useCurrency();
  const [display, setDisplay] = useState<string>(
    value !== undefined && value > 0
      ? formatWithCommas(value.toFixed(2))
      : ""
  );
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current && (value === undefined || value === null)) {
      setDisplay("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, "");
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      setDisplay(formatWithCommas(raw));
      const num = parseFloat(raw);
      onChange(raw === "" || isNaN(num) ? undefined : num);
    }
  };

  const handleFocus = () => {
    focused.current = true;
    const raw = display.replace(/,/g, "");
    if (raw === "0.00" || raw === "") {
      setDisplay("");
    } else {
      setDisplay(raw);
    }
  };

  const handleBlur = () => {
    focused.current = false;
    const raw = display.replace(/,/g, "");
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      setDisplay(num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      setDisplay("");
    }
    onBlur?.();
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm pointer-events-none">
        {symbol}
      </span>
      <Input
        data-testid={testId}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        className={cn("pl-7", className)}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </div>
  );
}
