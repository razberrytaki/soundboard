import type { SoundboardPadSummary } from "@/lib/soundboard/types";

import { PadCard } from "@/components/soundboard/pad-card";

type PadGridProps = {
  isManaging: boolean;
  pads: SoundboardPadSummary[];
  onPlay(pad: SoundboardPadSummary): void;
  onSelect(pad: SoundboardPadSummary): void;
  selectedPadId: string | null;
};

export function PadGrid({
  isManaging,
  pads,
  onPlay,
  onSelect,
  selectedPadId,
}: PadGridProps) {
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
        <PadCard
          isManaging={isManaging}
          isSelected={selectedPadId === pad.id}
          key={pad.id}
          onPlay={onPlay}
          onSelect={onSelect}
          pad={pad}
        />
      ))}
    </div>
  );
}
