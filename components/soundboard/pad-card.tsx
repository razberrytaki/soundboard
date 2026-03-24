import type { SoundboardPad } from "@/lib/soundboard/types";

type PadCardProps = {
  pad: SoundboardPad;
  onPlay(pad: SoundboardPad): void;
};

export function PadCard({ pad, onPlay }: PadCardProps) {
  return (
    <button
      aria-label={pad.label}
      className="aspect-square rounded-[26px] border border-[rgba(23,20,18,0.08)] bg-[rgba(255,255,255,0.68)] p-4 text-left shadow-[0_16px_36px_rgba(34,24,16,0.08)] transition-transform duration-200 hover:-translate-y-1"
      onClick={() => onPlay(pad)}
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
  );
}
