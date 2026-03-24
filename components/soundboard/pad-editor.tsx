"use client";

import { useState } from "react";

import type { SoundboardPad } from "@/lib/soundboard/types";

type PadEditorSubmitValue = {
  id?: string;
  label: string;
  color: string;
  audioBlob: Blob;
  audioName: string;
  mimeType: string;
};

type PadEditorProps = {
  mode: "create" | "edit";
  pad: SoundboardPad | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onClose(): void;
  onDelete(): void;
  onMoveDown(): void;
  onMoveUp(): void;
  onSave(value: PadEditorSubmitValue): Promise<void>;
};

const DEFAULT_COLOR = "#d95b43";

export function PadEditor({
  mode,
  pad,
  canMoveUp,
  canMoveDown,
  onClose,
  onDelete,
  onMoveDown,
  onMoveUp,
  onSave,
}: PadEditorProps) {
  const [label, setLabel] = useState(() => (mode === "edit" && pad ? pad.label : ""));
  const [color, setColor] = useState(() =>
    mode === "edit" && pad ? pad.color : DEFAULT_COLOR,
  );
  const [audioBlob, setAudioBlob] = useState<Blob | null>(() =>
    mode === "edit" && pad ? pad.audioBlob : null,
  );
  const [audioName, setAudioName] = useState(() =>
    mode === "edit" && pad ? pad.audioName : "",
  );
  const [mimeType, setMimeType] = useState(() =>
    mode === "edit" && pad ? pad.mimeType : "",
  );

  const handleSave = async () => {
    if (!audioBlob) {
      return;
    }

    await onSave({
      id: mode === "edit" ? pad?.id : undefined,
      label,
      color,
      audioBlob,
      audioName,
      mimeType,
    });
  };

  return (
    <aside className="rounded-[28px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.56)] p-5">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
            Inspector
          </p>
          <h3 className="text-2xl font-semibold tracking-[-0.04em]">
            {mode === "create" ? "Add Sound Pad" : "Edit Sound Pad"}
          </h3>
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            Set a label, choose a color, and attach the audio file stored in this
            browser.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">Name</span>
          <input
            className="w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">
            Audio File
          </span>
          <input
            accept="audio/*"
            className="block w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-4 py-3 text-sm"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];

              if (!nextFile) {
                return;
              }

              setAudioBlob(nextFile);
              setAudioName(nextFile.name);
              setMimeType(nextFile.type);
            }}
            type="file"
          />
          {audioName ? (
            <p className="text-xs text-[var(--color-muted)]">{audioName}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">Color</span>
          <input
            className="h-12 w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-2 py-2"
            onChange={(event) => setColor(event.target.value)}
            type="color"
            value={color}
          />
        </label>

        {mode === "edit" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-full border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] transition-colors hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              type="button"
            >
              Move Up
            </button>
            <button
              className="rounded-full border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] transition-colors hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              type="button"
            >
              Move Down
            </button>
          </div>
        ) : null}

        <div className="space-y-2">
          <button
            className="w-full rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!label.trim() || !audioBlob}
            onClick={() => void handleSave()}
            type="button"
          >
            Save Pad
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="rounded-full border border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink)] transition-colors hover:bg-white/70"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
            {mode === "edit" ? (
              <button
                className="rounded-full border border-[rgba(217,91,67,0.3)] bg-[rgba(217,91,67,0.12)] px-4 py-3 text-sm text-[var(--color-ink)] transition-colors hover:bg-[rgba(217,91,67,0.18)]"
                onClick={onDelete}
                type="button"
              >
                Delete Pad
              </button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
