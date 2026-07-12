type Range = "month" | "all";

export function RangeSwitch({
  value,
  onChange,
}: {
  value: Range;
  onChange: (v: Range) => void;
}) {
  return (
    <div
      className="relative grid grid-cols-2 rounded-full p-1"
      style={{
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.15))",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-out"
        style={{
          background: "linear-gradient(135deg, rgba(38,38,42,0.97), rgba(20,20,23,0.92))",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.25)",
          transform: value === "all" ? "translateX(100%)" : "translateX(0)",
        }}
      />
      {([
        { key: "month", label: "This Month" },
        { key: "all", label: "All Time" },
      ] as const).map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="relative z-10 py-2.5 text-sm font-bold transition-colors duration-300"
          style={{ color: value === t.key ? "#f9f8f8" : "rgba(2,2,3,0.5)" }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
