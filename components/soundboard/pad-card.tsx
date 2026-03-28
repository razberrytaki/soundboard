import type { SoundboardPad } from "@/lib/soundboard/types";

type PadCardProps = {
  pad: SoundboardPad;
  onEdit(pad: SoundboardPad): void;
  onPlay(pad: SoundboardPad): void;
};

export function PadCard({ pad, onEdit, onPlay }: PadCardProps) {
  return (
    <div className="relative">
      <button
        aria-label={pad.label}
        className="peer group/pad aspect-square w-full rounded-[26px] border border-[rgba(23,20,18,0.08)] bg-[rgba(255,255,255,0.68)] p-4 text-left shadow-[0_16px_36px_rgba(34,24,16,0.08)] transition-transform duration-200 hover:-translate-y-1"
        onClick={() => onPlay(pad)}
        style={{ "--pad-color": pad.color } as React.CSSProperties}
        type="button"
      >
        <div className="relative flex h-full items-center justify-center rounded-[18px] p-3 text-center text-white shadow-inner [background:linear-gradient(145deg,var(--pad-color),color-mix(in_srgb,var(--pad-color)_62%,white))]">
          <span className="line-clamp-2 text-center text-lg font-semibold tracking-[-0.03em]">
            {pad.label}
          </span>
        </div>
      </button>
      <button
        aria-label={`Edit ${pad.label}`}
        className="pointer-events-none absolute right-3 top-3 px-1 py-1 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-[0.18em] text-white/72 opacity-0 transition-[opacity,transform,color] duration-200 peer-hover:pointer-events-auto peer-hover:-translate-y-1 peer-hover:opacity-100 peer-hover:text-white peer-focus-visible:pointer-events-auto peer-focus-visible:-translate-y-1 peer-focus-visible:opacity-100 peer-focus-visible:text-white"
        onClick={() => onEdit(pad)}
        type="button"
      >
        Edit
      </button>
    </div>
  );
}
