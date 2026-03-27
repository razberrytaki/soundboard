export type AudioOutputRoutingLike = {
  setSinkId?: (sinkId: string) => Promise<void> | void;
};

type AudioOutputSelectionLike = {
  deviceId: string;
  label: string;
};

type AudioOutputDeviceLike = {
  deviceId: string;
  kind: string;
  label: string;
};

type MediaTrackLike = {
  stop(): void;
};

type MediaStreamLike = {
  getTracks(): MediaTrackLike[];
};

type NavigatorWithAudioOutputSelection = Navigator & {
  mediaDevices?: {
    enumerateDevices?: () => Promise<AudioOutputDeviceLike[]>;
    getUserMedia?: (constraints: { audio: boolean }) => Promise<MediaStreamLike>;
    selectAudioOutput?: (
      options?: {
        deviceId?: string;
      },
    ) => Promise<AudioOutputSelectionLike>;
  };
};

export type AudioOutputCapabilities = {
  secureContext: boolean;
  canRouteOutput: boolean;
  canPromptSelection: boolean;
  canEnumerateOutputs: boolean;
  canRequestInputPermission: boolean;
};

export type AudioOutputDevice = {
  deviceId: string;
  label: string;
};

function getNavigator() {
  return globalThis.navigator as NavigatorWithAudioOutputSelection | undefined;
}

function getMediaDevices() {
  return getNavigator()?.mediaDevices;
}

function getMediaElementPrototype() {
  return (
    globalThis.HTMLMediaElement?.prototype as
      | {
          setSinkId?: unknown;
        }
      | undefined
  );
}

export function getAudioOutputCapabilities(): AudioOutputCapabilities {
  const mediaDevices = getMediaDevices();
  const mediaElementPrototype = getMediaElementPrototype();

  return {
    secureContext: globalThis.isSecureContext ?? false,
    canRouteOutput: typeof mediaElementPrototype?.setSinkId === "function",
    canPromptSelection: typeof mediaDevices?.selectAudioOutput === "function",
    canEnumerateOutputs: typeof mediaDevices?.enumerateDevices === "function",
    canRequestInputPermission: typeof mediaDevices?.getUserMedia === "function",
  };
}

export function supportsAudioOutputSelection() {
  return getAudioOutputCapabilities().canPromptSelection;
}

export async function listAudioOutputDevices() {
  const mediaDevices = getMediaDevices();

  if (typeof mediaDevices?.enumerateDevices !== "function") {
    return [] satisfies AudioOutputDevice[];
  }

  const devices = await mediaDevices.enumerateDevices();
  const outputDevices = devices.filter((device) => device.kind === "audiooutput");

  return outputDevices.map((device, index) => ({
    deviceId: device.deviceId,
    label:
      device.label ||
      (device.deviceId === "default"
        ? "System Default"
        : `Output Device ${index + 1}`),
  }));
}

export async function requestAudioInputPermission() {
  const mediaDevices = getMediaDevices();

  if (typeof mediaDevices?.getUserMedia !== "function") {
    throw new Error("Microphone permission cannot be requested in this browser.");
  }

  const stream = await mediaDevices.getUserMedia({
    audio: true,
  });

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export async function selectAudioOutput(options?: { deviceId?: string | null }) {
  const mediaDevices = getMediaDevices();

  if (typeof mediaDevices?.selectAudioOutput !== "function") {
    throw new Error("Audio output selection is not supported in this browser.");
  }

  const selection = await mediaDevices.selectAudioOutput(
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
