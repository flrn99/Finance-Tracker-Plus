import { Mic, Plus } from "lucide-react";

export function EntryLauncher({
  onOpen,
  onVoice,
}: {
  onOpen: () => void;
  onVoice: () => void;
}) {
  return (
    <section className="flex items-stretch border-y border-border">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-w-0 flex-1 items-center gap-3 py-4 pr-4 text-left transition-opacity active:opacity-70"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform group-active:scale-95"
          style={{ background: "#CAFA01" }}
        >
          <Plus className="h-5 w-5 text-black" strokeWidth={2.5} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-bold tracking-tight text-foreground">New entry</span>
          <span className="text-xs text-muted-foreground">Log an expense or income</span>
        </span>
      </button>

      <div className="w-px shrink-0 bg-border" aria-hidden="true" />

      <button
        type="button"
        onClick={onVoice}
        aria-label="Add by voice"
        className="relative flex w-20 shrink-0 flex-col items-center justify-center gap-1.5 transition-opacity active:opacity-70"
      >
        <span className="absolute right-5 top-3 h-1.5 w-1.5 rounded-full" style={{ background: "#FF66D9" }} aria-hidden="true" />
        <Mic className="h-5 w-5 text-foreground" strokeWidth={2} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Say it</span>
      </button>
    </section>
  );
}
