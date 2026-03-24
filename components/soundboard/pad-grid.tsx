import type { SoundboardPad } from "@/lib/soundboard/types";

import { PadCard } from "@/components/soundboard/pad-card";

type PadGridProps = {
  pads: SoundboardPad[];
  onPlay(pad: SoundboardPad): void;
};

export function PadGrid({ pads, onPlay }: PadGridProps) {
  if (pads.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-[var(--color-line)] bg-[rgba(255,255,255,0.42)] px-6 py-10 text-center">
        <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
          Empty Board
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
          No sounds yet
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Add your first sound pad to make this board playable.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {pads.map((pad) => (
        <PadCard key={pad.id} pad={pad} onPlay={onPlay} />
      ))}
    </div>
  );
}
