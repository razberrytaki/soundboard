// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  selectAudioOutput,
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

  it("selects an audio output device and returns its metadata", async () => {
    const selectAudioOutputMock = vi.fn(async () => ({
      deviceId: "speaker-1",
      label: "Desk Speakers",
    }));

    vi.stubGlobal("navigator", {
      mediaDevices: {
        selectAudioOutput: selectAudioOutputMock,
      },
    });

    await expect(selectAudioOutput()).resolves.toEqual({
      deviceId: "speaker-1",
      label: "Desk Speakers",
    });
    expect(selectAudioOutputMock).toHaveBeenCalledWith(undefined);
  });

  it("passes the saved device id when selecting an audio output device", async () => {
    const selectAudioOutputMock = vi.fn(async () => ({
      deviceId: "speaker-2",
      label: "Mixer Output",
    }));

    vi.stubGlobal("navigator", {
      mediaDevices: {
        selectAudioOutput: selectAudioOutputMock,
      },
    });

    await selectAudioOutput({ deviceId: "speaker-1" });

    expect(selectAudioOutputMock).toHaveBeenCalledWith({
      deviceId: "speaker-1",
    });
  });

  it("throws when selection support is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(selectAudioOutput()).rejects.toThrow(
      /audio output selection is not supported/i,
    );
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
