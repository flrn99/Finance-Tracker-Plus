import { Wallet } from "lucide-react";

const ACCENT = "#B026FF";

export function BalanceHero({
  balance,
  spentPct,
  caption,
}: {
  balance: string;
  spentPct: number;
  caption: string;
}) {
  const segments = 14;
  const filled = Math.round((spentPct / 100) * segments);

  return (
    <section
      className="relative overflow-hidden rounded-3xl px-4 pt-4 pb-4"
      style={{ background: "linear-gradient(145deg, #F5E8FF 0%, #E4C6FF 55%, #CE9CFF 100%)" }}
    >
      {/* Blobs decorativos suaves — misma familia que el hero de Insights */}
      <div className="absolute -top-14 -right-10 w-44 h-44 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.4)" }} />
      <div className="absolute -bottom-14 -left-8 w-36 h-36 rounded-full pointer-events-none" style={{ background: "rgba(176,38,255,0.12)" }} />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}>
            <Wallet className="h-3.5 w-3.5" style={{ color: ACCENT }} strokeWidth={2} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#7A0DB3" }}>
            Total Balance
          </span>
        </div>
        <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.6)", color: "#7A0DB3" }}>
          {spentPct}% spent
        </span>
      </div>

      <p className="relative mt-3 font-serif font-bold leading-none tracking-tight" style={{ color: "#3B0764", fontSize: "2.4rem" }}>{balance}</p>
      <p className="relative mt-1.5 text-[11px] uppercase tracking-[0.15em]" style={{ color: "rgba(59,7,100,0.55)" }}>
        {caption}
      </p>

      {/* Medidor segmentado — mismo lenguaje del score de Insights */}
      <div className="relative flex gap-1 mt-3" aria-hidden="true">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2.5 rounded-full transition-all duration-500"
            style={{
              background: i < filled ? ACCENT : "rgba(59,7,100,0.10)",
              transitionDelay: `${i * 30}ms`,
            }}
          />
        ))}
      </div>
      <div className="relative mt-1.5 flex justify-between text-[10px] uppercase tracking-widest" style={{ color: "rgba(59,7,100,0.45)" }}>
        <span>Money spent</span>
        <span>{Math.max(0, 100 - spentPct)}% remaining</span>
      </div>
    </section>
  );
}
