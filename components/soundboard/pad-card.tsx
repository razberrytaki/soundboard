import { useEffect, useRef } from "react";

import type { SoundboardPad } from "@/lib/soundboard/types";

type PadCardProps = {
  pad: SoundboardPad;
  onEdit(pad: SoundboardPad): void;
  onPlay(pad: SoundboardPad): void;
};

const LONG_PRESS_MS = 450;

export function PadCard({ pad, onEdit, onPlay }: PadCardProps) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => clearLongPress, []);

  return (
    <div className="relative">
      <button
        aria-label={pad.label}
        className="peer group/pad aspect-square w-full rounded-[26px] border border-[rgba(23,20,18,0.08)] bg-[rgba(255,255,255,0.68)] p-4 text-left shadow-[0_16px_36px_rgba(34,24,16,0.08)] transition-transform duration-200 hover:-translate-y-1"
        onClick={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }

          onPlay(pad);
        }}
        onPointerCancel={clearLongPress}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") {
            return;
          }

          longPressTriggeredRef.current = false;
          clearLongPress();
          longPressTimerRef.current = window.setTimeout(() => {
            longPressTriggeredRef.current = true;
            onEdit(pad);
          }, LONG_PRESS_MS);
        }}
        onPointerLeave={clearLongPress}
        onPointerMove={clearLongPress}
        onPointerUp={clearLongPress}
        style={{ "--pad-color": pad.color } as React.CSSProperties}
        type="button"
      >
        <div className="relative flex h-full items-center justify-center rounded-[18px] p-3 text-center text-white shadow-inner [background:linear-gradient(145deg,var(--pad-color),color-mix(in_srgb,var(--pad-color)_62%,white))]">
          <span className="line-clamp-2 text-center text-lg font-semibold tracking-[-0.03em]">
            {pad.label}
          </span>
        </div>
      </button>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3 font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-[0.18em] text-white/72 opacity-0 transition-opacity duration-200 peer-hover:opacity-100 peer-focus-visible:opacity-100"
      >
        Edit
      </span>
      <button
        aria-label={`Edit ${pad.label}`}
        className="absolute right-2 top-2 h-8 w-12 rounded-md bg-transparent opacity-0 outline-none transition-opacity duration-200 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/80 peer-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(pad);
        }}
        type="button"
      />
    </div>
  );
}
