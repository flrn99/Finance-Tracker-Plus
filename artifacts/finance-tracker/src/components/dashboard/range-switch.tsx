import { cn } from "@/lib/utils";

type Range = "month" | "all";

export function RangeSwitch({
  value,
  onChange,
}: {
  value: Range;
  onChange: (v: Range) => void;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-full bg-muted p-1">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-out"
        style={{
          transform: value === "all" ? "translateX(100%)" : "translateX(0)",
          background: "#A8FF3E",
        }}
      />
      {([
        { key: "month", label: "This Month" },
        { key: "all", label: "All Time" },
      ] as const).map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative z-10 py-2.5 text-sm font-bold transition-colors duration-300",
            value === t.key ? "text-black" : "text-muted-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
