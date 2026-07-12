import { ArrowDownRight, ArrowUpRight } from "lucide-react";

function Tile({
  label,
  amount,
  caption,
  variant,
}: {
  label: string;
  amount: string;
  caption: string;
  variant: "expense" | "income";
}) {
  const isExpense = variant === "expense";
  const Icon = isExpense ? ArrowDownRight : ArrowUpRight;
  // Base color pedida (expense #FF4D4D / income #00FF9C), llevada a pastel claro — misma familia que el hero de Insights
  const bgGradient = isExpense
    ? "linear-gradient(145deg, #FFEDEE 0%, #FFD3D6 55%, #FFB0B5 100%)"
    : "linear-gradient(145deg, #E3FFF4 0%, #BFFFE3 55%, #8FFFCB 100%)";
  const blobTint = isExpense ? "rgba(255,77,77,0.12)" : "rgba(0,255,156,0.15)";
  const accent = isExpense ? "#FF4D4D" : "#00A870";
  const darkText = isExpense ? "#7F1D1D" : "#00432C";
  const labelText = isExpense ? "rgba(127,29,29,0.65)" : "rgba(0,67,44,0.65)";

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl p-3.5" style={{ background: bgGradient }}>
      {/* Blobs decorativos suaves — misma familia que el hero de Insights */}
      <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.4)" }} />
      <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full pointer-events-none" style={{ background: blobTint }} />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: labelText }}>{label}</span>
        <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}>
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={2.5} />
        </span>
      </div>
      <div className="relative mt-3">
        <p className="font-serif text-xl font-bold tracking-tight tabular-nums truncate" style={{ color: darkText }}>{amount}</p>
        <span className="text-[11px]" style={{ color: labelText }}>{caption}</span>
      </div>
    </div>
  );
}

export function StatTiles({
  caption,
  expense,
  income,
}: {
  caption: string;
  expense: string;
  income: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label="Expenses" amount={expense} caption={caption} variant="expense" />
      <Tile label="Income" amount={income} caption={caption} variant="income" />
    </div>
  );
}
