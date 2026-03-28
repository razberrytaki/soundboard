import type { SoundboardPad } from "@/lib/soundboard/types";

type PadCardProps = {
  pad: SoundboardPad;
  isManaging: boolean;
  isSelected: boolean;
  onPlay(pad: SoundboardPad): void;
  onSelect(pad: SoundboardPad): void;
};

export function PadCard({
  pad,
  isManaging,
  isSelected,
  onPlay,
  onSelect,
}: PadCardProps) {
  const handleClick = () => {
    if (!isManaging) {
      onPlay(pad);
      return;
    }

    if (isSelected) {
      onPlay(pad);
      return;
    }

    onSelect(pad);
  };

  return (
    <button
      aria-label={pad.label}
      className={`aspect-square w-full rounded-[26px] border bg-[rgba(255,255,255,0.68)] p-4 text-left shadow-[0_16px_36px_rgba(34,24,16,0.08)] transition-transform duration-200 hover:-translate-y-1 ${
        isSelected
          ? "border-[color:var(--color-ink)] ring-2 ring-[rgba(34,24,16,0.18)] ring-offset-2 ring-offset-[rgba(251,248,242,0.86)]"
          : "border-[rgba(23,20,18,0.08)]"
      }`}
      onClick={handleClick}
      style={{ "--pad-color": pad.color } as React.CSSProperties}
      type="button"
    >
      <div className="relative flex h-full items-center justify-center rounded-[18px] p-3 text-center text-white shadow-inner [background:linear-gradient(145deg,var(--pad-color),color-mix(in_srgb,var(--pad-color)_62%,white))]">
        <span className="line-clamp-2 text-center text-lg font-semibold tracking-[-0.03em]">
          {pad.label}
        </span>
      </div>
    </button>
  );
}
