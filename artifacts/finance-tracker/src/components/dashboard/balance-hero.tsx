export function BalanceHero({
  balance,
  caption,
  expenseAmount,
  incomeAmount,
}: {
  balance: string;
  caption: string;
  expenseAmount: string;
  incomeAmount: string;
}) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Balance · {caption}</p>

      <div className="relative mt-2 inline-block">
        <span
          aria-hidden="true"
          className="absolute z-0 h-4 rounded-sm"
          style={{
            left: "-2%",
            bottom: "10px",
            width: "88%",
            background: "#A8FF3E",
            opacity: 0.55,
            transform: "skewX(-8deg) rotate(-1.2deg)",
          }}
        />
        <p
          className="relative z-10 font-serif font-bold leading-none tracking-tight text-foreground"
          style={{ fontSize: "3.1rem" }}
        >
          {balance}
        </p>
      </div>

      <p className="mt-3.5 text-sm font-semibold text-muted-foreground">
        <span className="font-extrabold text-[#7F1D1D] dark:text-[#FFA3A3]">↓ {expenseAmount}</span> out
        <span className="mx-1.5 opacity-50">·</span>
        <span className="font-extrabold text-[#00432C] dark:text-[#6EE7B7]">↑ {incomeAmount}</span> in
      </p>
    </section>
  );
}
