// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  supportsAudioOutputRouting,
  supportsAudioOutputSelection,
} from "@/lib/soundboard/audio-output";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audio output support helpers", () => {
  it("detects selection support when the browser exposes selectAudioOutput", () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        selectAudioOutput: vi.fn(),
      },
    });

    expect(supportsAudioOutputSelection()).toBe(true);
  });

  it("returns false when selection support is unavailable", () => {
    vi.stubGlobal("navigator", {});

    expect(supportsAudioOutputSelection()).toBe(false);
  });

  it("detects audio output routing support when setSinkId exists", () => {
    expect(
      supportsAudioOutputRouting({
        setSinkId: vi.fn(),
      }),
    ).toBe(true);
  });

  it("returns false when audio output routing is unavailable", () => {
    expect(supportsAudioOutputRouting({})).toBe(false);
  });
});
