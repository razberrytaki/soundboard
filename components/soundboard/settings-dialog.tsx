"use client";

import type { SoundboardSettings } from "@/lib/soundboard/types";

type SettingsDialogProps = {
  open: boolean;
  settings: Pick<
    SoundboardSettings,
    "defaultPadVolume" | "allowConcurrentPlayback" | "showStopAllButton" | "preferredOutputDeviceLabel"
  >;
  audioOutputSupported: boolean;
  onClose(): void;
  onDefaultPadVolumeChange(value: number): void;
  onAllowConcurrentPlaybackChange(value: boolean): void;
  onShowStopAllButtonChange(value: boolean): void;
};

export function SettingsDialog({
  open,
  settings,
  audioOutputSupported,
  onClose,
  onDefaultPadVolumeChange,
  onAllowConcurrentPlaybackChange,
  onShowStopAllButtonChange,
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Settings"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,26,18,0.42)] px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-2xl rounded-[32px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.98)] p-6 shadow-[var(--shadow-shell)] md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
              Settings
            </p>
            <h2
              className="mt-2 text-3xl font-semibold tracking-[-0.05em]"
              id="settings-dialog-title"
            >
              Playback and Output
            </h2>
          </div>
          <button
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors duration-200 hover:bg-white/70 hover:text-[var(--color-ink)]"
            onClick={onClose}
            type="button"
          >
            Close settings
          </button>
        </div>

        <div className="mt-6 grid gap-5">
          <section className="rounded-[28px] border border-[var(--color-line)] bg-white/75 p-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Volume
              </p>
              <h3 className="text-xl font-semibold tracking-[-0.04em]">
                Default Pad Volume
              </h3>
              <p className="text-sm leading-6 text-[var(--color-muted)]">
                Sets the starting volume for pads that do not use their own override.
              </p>
            </div>

            <label className="mt-4 block space-y-3">
              <span className="flex items-center justify-between text-sm font-medium text-[var(--color-ink)]">
                <span>Default Pad Volume</span>
                <span>{settings.defaultPadVolume}%</span>
              </span>
              <input
                aria-label="Default Pad Volume"
                className="w-full accent-[var(--color-accent)]"
                max={100}
                min={0}
                onChange={(event) =>
                  onDefaultPadVolumeChange(Number(event.target.value))
                }
                type="range"
                value={settings.defaultPadVolume}
              />
            </label>
          </section>

          <section className="rounded-[28px] border border-[var(--color-line)] bg-white/75 p-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Playback
              </p>
              <h3 className="text-xl font-semibold tracking-[-0.04em]">
                Soundboard behavior
              </h3>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
                <input
                  checked={settings.allowConcurrentPlayback}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  onChange={(event) =>
                    onAllowConcurrentPlaybackChange(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Allow Concurrent Playback</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
                <input
                  checked={settings.showStopAllButton}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                  onChange={(event) =>
                    onShowStopAllButtonChange(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Show Stop All Button</span>
              </label>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--color-line)] bg-white/75 p-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Audio Output
              </p>
              <h3 className="text-xl font-semibold tracking-[-0.04em]">
                Output device routing
              </h3>
            </div>

            {audioOutputSupported ? (
              <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--color-muted)]">
                <p>System Default</p>
                <p>
                  {settings.preferredOutputDeviceLabel ??
                    "No preferred device saved yet."}
                </p>
                <button
                  className="w-fit rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/80"
                  disabled
                  type="button"
                >
                  Choose Device...
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-[rgba(217,91,67,0.22)] bg-[rgba(217,91,67,0.08)] p-4 text-sm leading-6 text-[var(--color-ink)]">
                Audio output selection is not supported in this browser. The app will
                use the system default output device. Some browsers require a secure
                context and a direct user gesture before device routing is available.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
