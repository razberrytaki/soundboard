import type { SoundboardPad } from "@/lib/soundboard/types";

type PadCardProps = {
  pad: SoundboardPad;
  onEdit(pad: SoundboardPad): void;
  onPlay(pad: SoundboardPad): void;
};

export function PadCard({ pad, onEdit, onPlay }: PadCardProps) {
  return (
    <div className="group relative">
      <button
        aria-label={pad.label}
        className="aspect-square w-full rounded-[26px] border border-[rgba(23,20,18,0.08)] bg-[rgba(255,255,255,0.68)] p-4 text-left shadow-[0_16px_36px_rgba(34,24,16,0.08)] transition-transform duration-200 hover:-translate-y-1"
        onClick={() => onPlay(pad)}
        style={{ "--pad-color": pad.color } as React.CSSProperties}
        type="button"
      >
        <div className="relative flex h-full items-center justify-center rounded-[18px] p-3 text-center text-white shadow-inner [background:linear-gradient(145deg,var(--pad-color),color-mix(in_srgb,var(--pad-color)_62%,white))]">
          <span className="pointer-events-none absolute left-3 top-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-white/72 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            Play
          </span>
          <span className="line-clamp-2 text-center text-lg font-semibold tracking-[-0.03em]">
            {pad.label}
          </span>
        </div>
      </button>
      <button
        aria-label={`Edit ${pad.label}`}
        className="absolute right-3 top-3 rounded-full border border-white/24 bg-[rgba(24,18,14,0.52)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white opacity-0 transition-opacity duration-200 hover:bg-[rgba(24,18,14,0.7)] group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={() => onEdit(pad)}
        type="button"
      >
        Edit
      </button>
    </div>
  );
}
