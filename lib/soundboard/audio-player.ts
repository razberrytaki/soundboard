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
  maxCachedEntries?: number;
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
  blob: Blob;
  objectUrl: string;
  onEnded: () => void;
  onError: () => void;
};

type CachedEntry = {
  audio: AudioLike;
  objectUrl: string;
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
  const maxCachedEntries = options.maxCachedEntries ?? 8;
  const active = new Map<string, ActiveEntry>();
  const idleCache = new Map<Blob, CachedEntry>();
  let allowConcurrentPlayback = options.allowConcurrentPlayback ?? true;

  const evictIdleEntries = () => {
    if (maxCachedEntries < 0) {
      return;
    }

    while (idleCache.size > maxCachedEntries) {
      const oldestEntry = idleCache.entries().next().value;

      if (!oldestEntry) {
        return;
      }

      const [blob, entry] = oldestEntry;

      idleCache.delete(blob);
      entry.audio.pause();
      entry.audio.currentTime = 0;
      revokeObjectUrl(entry.objectUrl);
    }
  };

  const cacheIdleEntry = (blob: Blob, entry: CachedEntry) => {
    if (maxCachedEntries <= 0) {
      revokeObjectUrl(entry.objectUrl);
      return;
    }

    const existingEntry = idleCache.get(blob);

    if (existingEntry) {
      idleCache.delete(blob);
      entry.audio.pause();
      entry.audio.currentTime = 0;
      revokeObjectUrl(entry.objectUrl);
      idleCache.set(blob, existingEntry);
      return;
    }

    idleCache.set(blob, entry);
    evictIdleEntries();
  };

  const cleanup = (id: string, resetPlayback: boolean) => {
    const entry = active.get(id);

    if (!entry) {
      return;
    }

    entry.audio.removeEventListener("ended", entry.onEnded);
    entry.audio.removeEventListener("error", entry.onError);
    active.delete(id);

    if (resetPlayback) {
      entry.audio.pause();
      entry.audio.currentTime = 0;
      revokeObjectUrl(entry.objectUrl);
      return;
    }

    entry.audio.currentTime = 0;
    cacheIdleEntry(entry.blob, {
      audio: entry.audio,
      objectUrl: entry.objectUrl,
    });
  };

  return {
    async play(blob: Blob, playbackOptions: PlaybackOptions = { volume: 100 }) {
      if (!allowConcurrentPlayback) {
        for (const id of [...active.keys()]) {
          cleanup(id, true);
        }
      }

      const id = crypto.randomUUID();
      const cachedEntry = idleCache.get(blob);

      if (cachedEntry) {
        idleCache.delete(blob);
      }

      const objectUrl = cachedEntry?.objectUrl ?? createObjectUrl(blob);
      const audio = cachedEntry?.audio ?? createAudio(objectUrl);
      const entry: ActiveEntry = {
        audio,
        blob,
        objectUrl,
        onEnded: () => cleanup(id, false),
        onError: () => cleanup(id, true),
      };

      audio.addEventListener("ended", entry.onEnded);
      audio.addEventListener("error", entry.onError);
      active.set(id, entry);
      audio.currentTime = 0;
      audio.volume = normalizeVolume(playbackOptions.volume);

      const outputDeviceId = playbackOptions.outputDeviceId ?? null;

      if (outputDeviceId && supportsAudioOutputRouting(audio)) {
        try {
          await audio.setSinkId(outputDeviceId);
        } catch {
          // Keep playing on the default output device when sink routing fails.
        }
      }

      if (!active.has(id)) {
        return;
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
