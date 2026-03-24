// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createAudioPlayer } from "@/lib/soundboard/audio-player";

type Listener = () => void;

class FakeAudio {
  currentTime = 0;
  paused = false;
  playCalls = 0;
  src: string;

  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(src: string) {
    this.src = src;
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();

    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  async play() {
    this.playCalls += 1;
  }

  pause() {
    this.paused = true;
  }

  finish() {
    for (const listener of this.listeners.get("ended") ?? []) {
      listener();
    }
  }
}

describe("createAudioPlayer", () => {
  it("creates an audio instance from a blob and tracks it as active", async () => {
    const createdAudio: FakeAudio[] = [];
    const revokedUrls: string[] = [];
    const player = createAudioPlayer({
      allowConcurrentPlayback: true,
      createObjectUrl: () => "blob:airhorn",
      revokeObjectUrl: (url) => revokedUrls.push(url),
      createAudio: (src) => {
        const audio = new FakeAudio(src);

        createdAudio.push(audio);
        return audio;
      },
    });

    await player.play(new Blob(["a"], { type: "audio/mpeg" }));

    expect(createdAudio).toHaveLength(1);
    expect(createdAudio[0]?.src).toBe("blob:airhorn");
    expect(createdAudio[0]?.playCalls).toBe(1);
    expect(player.getActiveCount()).toBe(1);
    expect(revokedUrls).toHaveLength(0);
  });

  it("allows multiple active sounds when concurrent playback is enabled", async () => {
    const createdAudio: FakeAudio[] = [];
    const player = createAudioPlayer({
      allowConcurrentPlayback: true,
      createObjectUrl: () => `blob:${createdAudio.length + 1}`,
      revokeObjectUrl: () => undefined,
      createAudio: (src) => {
        const audio = new FakeAudio(src);

        createdAudio.push(audio);
        return audio;
      },
    });

    await player.play(new Blob(["a"], { type: "audio/mpeg" }));
    await player.play(new Blob(["b"], { type: "audio/mpeg" }));

    expect(player.getActiveCount()).toBe(2);
    expect(createdAudio.every((audio) => audio.paused === false)).toBe(true);
  });

  it("stops existing playback before starting a new sound when concurrent playback is disabled", async () => {
    const createdAudio: FakeAudio[] = [];
    const player = createAudioPlayer({
      allowConcurrentPlayback: false,
      createObjectUrl: () => `blob:${createdAudio.length + 1}`,
      revokeObjectUrl: () => undefined,
      createAudio: (src) => {
        const audio = new FakeAudio(src);

        createdAudio.push(audio);
        return audio;
      },
    });

    await player.play(new Blob(["a"], { type: "audio/mpeg" }));
    await player.play(new Blob(["b"], { type: "audio/mpeg" }));

    expect(createdAudio[0]?.paused).toBe(true);
    expect(createdAudio[0]?.currentTime).toBe(0);
    expect(createdAudio[1]?.paused).toBe(false);
    expect(player.getActiveCount()).toBe(1);
  });

  it("cleans up completed audio instances and revokes their object URLs", async () => {
    const createdAudio: FakeAudio[] = [];
    const revokedUrls: string[] = [];
    const player = createAudioPlayer({
      allowConcurrentPlayback: true,
      createObjectUrl: () => "blob:done",
      revokeObjectUrl: (url) => revokedUrls.push(url),
      createAudio: (src) => {
        const audio = new FakeAudio(src);

        createdAudio.push(audio);
        return audio;
      },
    });

    await player.play(new Blob(["a"], { type: "audio/mpeg" }));
    createdAudio[0]?.finish();

    expect(player.getActiveCount()).toBe(0);
    expect(revokedUrls).toEqual(["blob:done"]);
  });
});
