import { supportsAudioOutputRouting } from "@/lib/soundboard/audio-output";

type AudioLike = {
  currentTime: number;
  volume: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: "ended" | "error", listener: () => void): void;
  removeEventListener(type: "ended" | "error", listener: () => void): void;
  setSinkId?: (sinkId: string) => Promise<void>;
};

type CreateAudioPlayerOptions = {
  allowConcurrentPlayback?: boolean;
  createAudio?: (src: string) => AudioLike;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
};

type PlaybackOptions = {
  volume: number;
  outputDeviceId?: string | null;
};

type ActiveEntry = {
  audio: AudioLike;
  objectUrl: string;
  onEnded: () => void;
  onError: () => void;
};

function defaultCreateAudio(src: string) {
  const audio = new Audio(src);

  audio.preload = "auto";
  return audio;
}

function normalizeVolume(volume: number) {
  return Math.min(1, Math.max(0, volume / 100));
}

export function createAudioPlayer(options: CreateAudioPlayerOptions = {}) {
  const createAudio = options.createAudio ?? defaultCreateAudio;
  const createObjectUrl = options.createObjectUrl ?? URL.createObjectURL;
  const revokeObjectUrl = options.revokeObjectUrl ?? URL.revokeObjectURL;
  const active = new Map<string, ActiveEntry>();
  let allowConcurrentPlayback = options.allowConcurrentPlayback ?? true;

  const cleanup = (id: string, resetPlayback: boolean) => {
    const entry = active.get(id);

    if (!entry) {
      return;
    }

    entry.audio.removeEventListener("ended", entry.onEnded);
    entry.audio.removeEventListener("error", entry.onError);

    if (resetPlayback) {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    }

    active.delete(id);
    revokeObjectUrl(entry.objectUrl);
  };

  return {
    async play(blob: Blob, playbackOptions: PlaybackOptions = { volume: 100 }) {
      if (!allowConcurrentPlayback) {
        for (const id of [...active.keys()]) {
          cleanup(id, true);
        }
      }

      const id = crypto.randomUUID();
      const objectUrl = createObjectUrl(blob);
      const audio = createAudio(objectUrl);
      const entry: ActiveEntry = {
        audio,
        objectUrl,
        onEnded: () => cleanup(id, false),
        onError: () => cleanup(id, true),
      };

      audio.addEventListener("ended", entry.onEnded);
      audio.addEventListener("error", entry.onError);
      active.set(id, entry);
      audio.volume = normalizeVolume(playbackOptions.volume);

      const outputDeviceId = playbackOptions.outputDeviceId ?? null;

      if (outputDeviceId && supportsAudioOutputRouting(audio)) {
        try {
          await audio.setSinkId(outputDeviceId);
        } catch {
          // Keep playing on the default output device when sink routing fails.
        }
      }

      try {
        await audio.play();
      } catch (error) {
        cleanup(id, true);
        throw error;
      }
    },

    getActiveCount() {
      return active.size;
    },

    setAllowConcurrentPlayback(value: boolean) {
      allowConcurrentPlayback = value;
    },

    stopAll() {
      for (const id of [...active.keys()]) {
        cleanup(id, true);
      }
    },
  };
}
