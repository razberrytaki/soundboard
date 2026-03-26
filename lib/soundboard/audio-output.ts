type AudioOutputRoutingLike = {
  setSinkId?: (sinkId: string) => Promise<void> | void;
};

type NavigatorWithAudioOutputSelection = Navigator & {
  mediaDevices?: {
    selectAudioOutput?: unknown;
  };
};

export function supportsAudioOutputSelection() {
  const navigator = globalThis.navigator as NavigatorWithAudioOutputSelection | undefined;

  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.selectAudioOutput === "function"
  );
}

export function supportsAudioOutputRouting(
  audio: AudioOutputRoutingLike,
): audio is AudioOutputRoutingLike & Required<Pick<AudioOutputRoutingLike, "setSinkId">> {
  return typeof audio.setSinkId === "function";
}
