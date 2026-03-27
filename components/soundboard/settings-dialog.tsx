"use client";

import type {
  AudioOutputCapabilities,
  AudioOutputDevice,
} from "@/lib/soundboard/audio-output";
import type { SoundboardSettings } from "@/lib/soundboard/types";

type SettingsDialogProps = {
  open: boolean;
  settings: Pick<
    SoundboardSettings,
    | "defaultPadVolume"
    | "allowConcurrentPlayback"
    | "showStopAllButton"
    | "preferredOutputDeviceId"
    | "preferredOutputDeviceLabel"
  >;
  audioOutputCapabilities: AudioOutputCapabilities;
  audioOutputDevices: AudioOutputDevice[];
  isChoosingAudioOutput: boolean;
  isLoadingAudioOutputDevices: boolean;
  isRequestingAudioPermission: boolean;
  audioOutputError: string | null;
  onClose(): void;
  onDefaultPadVolumeChange(value: number): void;
  onAllowConcurrentPlaybackChange(value: boolean): void;
  onShowStopAllButtonChange(value: boolean): void;
  onChooseAudioOutput(): void;
  onSelectListedAudioOutput(device: AudioOutputDevice): void;
  onRequestAudioPermission(): void;
  onResetAudioOutput(): void;
};

export function SettingsDialog({
  open,
  settings,
  audioOutputCapabilities,
  audioOutputDevices,
  isChoosingAudioOutput,
  isLoadingAudioOutputDevices,
  isRequestingAudioPermission,
  audioOutputError,
  onClose,
  onDefaultPadVolumeChange,
  onAllowConcurrentPlaybackChange,
  onShowStopAllButtonChange,
  onChooseAudioOutput,
  onSelectListedAudioOutput,
  onRequestAudioPermission,
  onResetAudioOutput,
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  const canManageOutput =
    audioOutputCapabilities.secureContext && audioOutputCapabilities.canRouteOutput;
  const showManualDeviceList =
    canManageOutput && audioOutputCapabilities.canEnumerateOutputs;
  const showPermissionPrompt =
    showManualDeviceList &&
    audioOutputDevices.length === 0 &&
    audioOutputCapabilities.canRequestInputPermission;

  return (
    <div
      aria-label="Settings"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(31,26,18,0.42)] px-4 py-4 backdrop-blur-sm md:px-6 md:py-6"
      role="dialog"
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.98)] shadow-[var(--shadow-shell)] md:max-h-[calc(100vh-3rem)]"
        data-testid="settings-dialog-panel"
      >
        <div className="flex shrink-0 flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between md:px-8 md:pt-8">
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

        <div
          className="mt-6 min-h-0 overflow-y-auto px-6 pb-6 md:px-8 md:pb-8"
          data-testid="settings-dialog-body"
        >
          <div className="grid gap-5">
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

            {!audioOutputCapabilities.secureContext ? (
              <div className="mt-4 rounded-2xl border border-[rgba(217,91,67,0.22)] bg-[rgba(217,91,67,0.08)] p-4 text-sm leading-6 text-[var(--color-ink)]">
                Audio output routing requires a secure context. The app will use the
                system default output device until it is opened over HTTPS or
                localhost.
              </div>
            ) : !audioOutputCapabilities.canRouteOutput ? (
              <div className="mt-4 rounded-2xl border border-[rgba(217,91,67,0.22)] bg-[rgba(217,91,67,0.08)] p-4 text-sm leading-6 text-[var(--color-ink)]">
                Audio output selection is not supported in this browser. The app will
                use the system default output device.
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--color-muted)]">
                <p>
                  {settings.preferredOutputDeviceLabel
                    ? `Selected output: ${settings.preferredOutputDeviceLabel}`
                    : "System Default"}
                </p>

                <div className="flex flex-wrap gap-2">
                  {audioOutputCapabilities.canPromptSelection ? (
                    <button
                      className="w-fit rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isChoosingAudioOutput}
                      onClick={onChooseAudioOutput}
                      type="button"
                    >
                      {isChoosingAudioOutput ? "Choosing..." : "Choose Device..."}
                    </button>
                  ) : null}
                  {settings.preferredOutputDeviceId ? (
                    <button
                      className="w-fit rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition-colors duration-200 hover:bg-white/80"
                      onClick={onResetAudioOutput}
                      type="button"
                    >
                      Use System Default
                    </button>
                  ) : null}
                </div>

                {showManualDeviceList ? (
                  <div className="space-y-3 rounded-3xl border border-[var(--color-line)] bg-white/60 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[var(--color-ink)]">
                        Available output devices
                      </p>
                      <p className="text-xs leading-5 text-[var(--color-muted)]">
                        Some browsers do not show every output device until additional
                        media permission is granted.
                      </p>
                    </div>

                    {isLoadingAudioOutputDevices ? (
                      <p>Scanning output devices...</p>
                    ) : audioOutputDevices.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {audioOutputDevices.map((device) => (
                          <button
                            key={device.deviceId}
                            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/80"
                            onClick={() => onSelectListedAudioOutput(device)}
                            type="button"
                          >
                            {settings.preferredOutputDeviceId === device.deviceId
                              ? `Using ${device.label}`
                              : `Use ${device.label}`}
                          </button>
                        ))}
                      </div>
                    ) : showPermissionPrompt ? (
                      <div className="rounded-2xl border border-[rgba(217,91,67,0.16)] bg-[rgba(217,91,67,0.06)] p-4 text-[var(--color-ink)]">
                        <p className="text-sm leading-6">
                          To list more output devices, this browser may require
                          temporary microphone permission.
                        </p>
                        <p className="mt-2 text-sm leading-6">
                          This does not start recording. The permission is only used
                          so the browser can reveal related audio devices for output
                          routing.
                        </p>
                        <button
                          className="mt-3 rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isRequestingAudioPermission}
                          onClick={onRequestAudioPermission}
                          type="button"
                        >
                          {isRequestingAudioPermission
                            ? "Requesting access..."
                            : "Grant access to more devices"}
                        </button>
                      </div>
                    ) : (
                      <p>No alternative output devices are currently available.</p>
                    )}
                  </div>
                ) : null}

                {audioOutputError ? (
                  <p className="rounded-2xl border border-[rgba(217,91,67,0.22)] bg-[rgba(217,91,67,0.08)] p-4 text-sm leading-6 text-[var(--color-ink)]">
                    {audioOutputError}
                  </p>
                ) : null}
              </div>
            )}
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
