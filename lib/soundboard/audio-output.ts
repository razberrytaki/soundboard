type AudioOutputRoutingLike = {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export function supportsAudioOutputSelection() {
  return (
    typeof globalThis.navigator !== "undefined" &&
    typeof globalThis.navigator.mediaDevices?.selectAudioOutput === "function"
  );
}

export function supportsAudioOutputRouting(audio: AudioOutputRoutingLike) {
  return typeof audio.setSinkId === "function";
}
