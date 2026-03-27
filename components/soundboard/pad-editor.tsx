"use client";

import { useEffect, useId, useState } from "react";

import type { SoundboardPad } from "@/lib/soundboard/types";
import {
  PAD_NAME_MAX_LENGTH,
  limitPadNameInput,
  normalizePadName,
  validateAudioFile,
  validatePadName,
} from "@/lib/soundboard/validation";

type PadEditorSubmitValue = {
  id?: string;
  label: string;
  color: string;
  audioBlob: Blob;
  audioName: string;
  mimeType: string;
  volumeOverride: number | null;
};

type PadEditorProps = {
  mode: "create" | "edit";
  pad: SoundboardPad | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDirtyChange(value: boolean): void;
  onDelete(): void;
  onMoveDown(): void;
  onMoveUp(): void;
  onSave(value: PadEditorSubmitValue): Promise<void>;
};

const DEFAULT_COLOR = "#d95b43";
const DEFAULT_VOLUME = 100;

export function PadEditor({
  mode,
  pad,
  canMoveUp,
  canMoveDown,
  onDirtyChange,
  onDelete,
  onMoveDown,
  onMoveUp,
  onSave,
}: PadEditorProps) {
  const nameErrorId = useId();
  const audioErrorId = useId();
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
  const [useDefaultVolume, setUseDefaultVolume] = useState(
    () => !(mode === "edit" && pad?.volumeOverride !== null),
  );
  const [volumeOverride, setVolumeOverride] = useState(() =>
    mode === "edit" && pad?.volumeOverride !== null ? pad.volumeOverride : DEFAULT_VOLUME,
  );
  const [nameTouched, setNameTouched] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const initialLabel = mode === "edit" && pad ? pad.label : "";
  const initialColor = mode === "edit" && pad ? pad.color : DEFAULT_COLOR;
  const initialAudioBlob = mode === "edit" && pad ? pad.audioBlob : null;
  const initialAudioName = mode === "edit" && pad ? pad.audioName : "";
  const initialMimeType = mode === "edit" && pad ? pad.mimeType : "";
  const initialUseDefaultVolume = !(mode === "edit" && pad?.volumeOverride !== null);
  const initialVolumeOverride =
    mode === "edit" && pad?.volumeOverride !== null ? pad.volumeOverride : DEFAULT_VOLUME;
  const effectiveVolumeOverride = useDefaultVolume ? null : volumeOverride;
  const initialEffectiveVolumeOverride =
    mode === "edit" && pad ? pad.volumeOverride : null;
  const nameError = nameTouched ? validatePadName(label) : null;
  const normalizedLabel = normalizePadName(label);
  const canSave = !validatePadName(label) && !audioError && Boolean(audioBlob);

  useEffect(() => {
    const isDirty =
      label !== initialLabel ||
      color !== initialColor ||
      audioBlob !== initialAudioBlob ||
      audioName !== initialAudioName ||
      mimeType !== initialMimeType ||
      useDefaultVolume !== initialUseDefaultVolume ||
      effectiveVolumeOverride !== initialEffectiveVolumeOverride;

    onDirtyChange(isDirty);
  }, [
    audioBlob,
    audioName,
    color,
    initialAudioBlob,
    initialAudioName,
    initialColor,
    initialLabel,
    initialMimeType,
    initialUseDefaultVolume,
    initialVolumeOverride,
    initialEffectiveVolumeOverride,
    label,
    mimeType,
    onDirtyChange,
    useDefaultVolume,
    effectiveVolumeOverride,
  ]);

  const handleSave = async () => {
    if (!audioBlob || audioError) {
      setNameTouched(true);
      return;
    }

    if (validatePadName(label)) {
      setNameTouched(true);
      return;
    }

    await onSave({
      id: mode === "edit" ? pad?.id : undefined,
      label: normalizedLabel,
      color,
      audioBlob,
      audioName,
      mimeType,
      volumeOverride: effectiveVolumeOverride,
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

        <div className="space-y-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">Name</span>
            <input
              aria-describedby={nameError ? nameErrorId : undefined}
              aria-invalid={nameError ? "true" : "false"}
              className="w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              maxLength={PAD_NAME_MAX_LENGTH}
              onBlur={() => setNameTouched(true)}
              onChange={(event) => {
                setNameTouched(true);
                setLabel(limitPadNameInput(event.target.value));
              }}
              value={label}
            />
          </label>
          {nameError ? (
            <p
              className="text-xs text-[var(--color-accent)]"
              id={nameErrorId}
              role="alert"
            >
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Audio File
            </span>
            <input
              accept="audio/*"
              aria-describedby={audioError ? audioErrorId : undefined}
              aria-invalid={audioError ? "true" : "false"}
              className="block w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-4 py-3 text-sm"
              onChange={(event) => {
                const nextFile = event.target.files?.[0];

                if (!nextFile) {
                  return;
                }

                const nextAudioError = validateAudioFile(nextFile);

                if (nextAudioError) {
                  setAudioError(nextAudioError);

                  if (mode === "create") {
                    setAudioBlob(null);
                    setAudioName("");
                    setMimeType("");
                  }

                  return;
                }

                setAudioError(null);
                setAudioBlob(nextFile);
                setAudioName(nextFile.name);
                setMimeType(nextFile.type);
              }}
              type="file"
            />
          </label>
          {audioName ? (
            <p className="text-xs text-[var(--color-muted)]">{audioName}</p>
          ) : null}
          {audioError ? (
            <p
              className="text-xs text-[var(--color-accent)]"
              id={audioErrorId}
              role="alert"
            >
              {audioError}
            </p>
          ) : null}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--color-ink)]">Color</span>
          <input
            className="h-12 w-full rounded-2xl border border-[var(--color-line)] bg-white/80 px-2 py-2"
            onChange={(event) => setColor(event.target.value)}
            type="color"
            value={color}
          />
        </label>

        <div className="space-y-3 rounded-3xl border border-[var(--color-line)] bg-white/50 p-4">
          <label className="flex items-center gap-3">
            <input
              checked={useDefaultVolume}
              onChange={(event) => setUseDefaultVolume(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Use default volume
            </span>
          </label>

          {!useDefaultVolume ? (
            <label className="block space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--color-ink)]">
                  Pad Volume
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  {volumeOverride}%
                </span>
              </div>
              <input
                aria-label="Pad Volume"
                className="w-full"
                max={100}
                min={0}
                onChange={(event) => setVolumeOverride(Number(event.target.value))}
                type="range"
                value={volumeOverride}
              />
            </label>
          ) : null}
        </div>

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
            disabled={!canSave}
            onClick={() => void handleSave()}
            type="button"
          >
            Save Pad
          </button>
          <div className="grid grid-cols-2 gap-2">
            {mode === "edit" ? (
              <button
                className="rounded-full border border-[rgba(217,91,67,0.3)] bg-[rgba(217,91,67,0.12)] px-4 py-3 text-sm text-[var(--color-ink)] transition-colors hover:bg-[rgba(217,91,67,0.18)]"
                onClick={onDelete}
                type="button"
              >
                Delete Pad
              </button>
            ) : (
              <div className="col-span-2" />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
