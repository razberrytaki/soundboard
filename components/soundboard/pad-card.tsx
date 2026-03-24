import type { SoundboardPad } from "@/lib/soundboard/types";

type PadCardProps = {
  pad: SoundboardPad;
  onEdit(pad: SoundboardPad): void;
  onPlay(pad: SoundboardPad): void;
};

export function PadCard({ pad, onEdit, onPlay }: PadCardProps) {
  return (
    <div className="space-y-2">
      <button
        aria-label={pad.label}
        className="aspect-square w-full rounded-[26px] border border-[rgba(23,20,18,0.08)] bg-[rgba(255,255,255,0.68)] p-4 text-left shadow-[0_16px_36px_rgba(34,24,16,0.08)] transition-transform duration-200 hover:-translate-y-1"
        onClick={() => onPlay(pad)}
        style={{ "--pad-color": pad.color } as React.CSSProperties}
        type="button"
      >
        <div className="flex h-full flex-col justify-between rounded-[18px] p-3 text-white shadow-inner [background:linear-gradient(145deg,var(--pad-color),color-mix(in_srgb,var(--pad-color)_62%,white))]">
          <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-white/72">
            Play
          </span>
          <span className="text-lg font-semibold tracking-[-0.03em]">
            {pad.label}
          </span>
        </div>
      </button>
      <button
        aria-label={`Edit ${pad.label}`}
        className="w-full rounded-full border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/70"
        onClick={() => onEdit(pad)}
        type="button"
      >
        Edit
      </button>
    </div>
  );
}
