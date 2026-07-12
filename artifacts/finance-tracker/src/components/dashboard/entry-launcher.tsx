import { Mic, Plus, TrendingDown, TrendingUp } from "lucide-react";

export function EntryLauncher({
  onOpen,
  onVoice,
}: {
  onOpen: () => void;
  onVoice: () => void;
}) {
  return (
    <section className="relative flex overflow-hidden rounded-3xl" style={{ background: "linear-gradient(145deg, #FFEAFB 0%, #FFD1F5 55%, #FF9FE8 100%)" }}>
      {/* Blobs decorativos suaves — misma familia que Balance/Insights */}
      <div className="absolute -top-12 -right-8 w-36 h-36 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,0.4)" }} />
      <div className="absolute -bottom-12 -left-6 w-28 h-28 rounded-full pointer-events-none" style={{ background: "rgba(255,102,217,0.15)" }} />

      <button
        type="button"
        onClick={onOpen}
        className="group relative flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform group-active:scale-95" style={{ background: "rgba(255,255,255,0.6)" }}>
          <Plus className="h-5 w-5" style={{ color: "#C21B96" }} strokeWidth={2.5} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#7A0A5C" }}>New entry</span>
          <span className="mt-1 flex items-center justify-start gap-1.5 text-[11px] font-bold" style={{ color: "#7A0A5C" }}>
            <span className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}>
                <TrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
              Out
            </span>
            <span className="opacity-50">·</span>
            <span className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}>
                <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
              In
            </span>
          </span>
        </span>
      </button>

      {/* Say it — franja vertical compacta */}
      <button
        type="button"
        onClick={onVoice}
        aria-label="Add by voice"
        className="relative flex w-16 shrink-0 flex-col items-center justify-center gap-2 active:scale-[0.97] transition-transform"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}>
          <Mic className="h-4 w-4" style={{ color: "#A8156F" }} strokeWidth={2.25} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7A0A5C" }}>Say it</span>
      </button>
    </section>
  );
}
