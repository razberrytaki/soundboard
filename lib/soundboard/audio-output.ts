type AudioOutputRoutingLike = {
  setSinkId?: (sinkId: string) => Promise<void> | void;
};

type AudioOutputSelectionLike = {
  deviceId: string;
  label: string;
};

type NavigatorWithAudioOutputSelection = Navigator & {
  mediaDevices?: {
    selectAudioOutput?: (
      options?: {
        deviceId?: string;
      },
    ) => Promise<AudioOutputSelectionLike>;
  };
};

export function supportsAudioOutputSelection() {
  const navigator = globalThis.navigator as NavigatorWithAudioOutputSelection | undefined;

  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.selectAudioOutput === "function"
  );
}

export async function selectAudioOutput(options?: { deviceId?: string | null }) {
  const navigator = globalThis.navigator as NavigatorWithAudioOutputSelection | undefined;

  if (
    typeof navigator === "undefined" ||
    typeof navigator.mediaDevices?.selectAudioOutput !== "function"
  ) {
    throw new Error("Audio output selection is not supported in this browser.");
  }

  const selection = await navigator.mediaDevices.selectAudioOutput(
    options?.deviceId
      ? {
          deviceId: options.deviceId,
        }
      : undefined,
  );

  return {
    deviceId: selection.deviceId,
    label: selection.label,
  };
}

export function supportsAudioOutputRouting(
  audio: AudioOutputRoutingLike,
): audio is AudioOutputRoutingLike & Required<Pick<AudioOutputRoutingLike, "setSinkId">> {
  return typeof audio.setSinkId === "function";
}
