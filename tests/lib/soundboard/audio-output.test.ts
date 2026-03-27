// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAudioOutputCapabilities,
  listAudioOutputDevices,
  requestAudioInputPermission,
  selectAudioOutput,
  supportsAudioOutputRouting,
} from "@/lib/soundboard/audio-output";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audio output support helpers", () => {
  it("reports picker, routing, enumeration, and permission capabilities", () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn(),
        getUserMedia: vi.fn(),
        selectAudioOutput: vi.fn(),
      },
    });
    function HtmlMediaElementFixture() {}

    HtmlMediaElementFixture.prototype = {
      setSinkId: vi.fn(),
    };

    vi.stubGlobal("HTMLMediaElement", HtmlMediaElementFixture);

    expect(getAudioOutputCapabilities()).toEqual({
      secureContext: true,
      canRouteOutput: true,
      canPromptSelection: true,
      canEnumerateOutputs: true,
      canRequestInputPermission: true,
    });
  });

  it("lists only selectable audio output devices", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: "mic-1", kind: "audioinput", label: "Mic" },
          { deviceId: "default", kind: "audiooutput", label: "System Default" },
          { deviceId: "speaker-1", kind: "audiooutput", label: "Desk Speakers" },
        ]),
      },
    });

    await expect(listAudioOutputDevices()).resolves.toEqual([
      { deviceId: "speaker-1", label: "Desk Speakers" },
    ]);
  });

  it("omits default-only output entries from the selectable device list", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: "", kind: "audioinput", label: "" },
          { deviceId: "", kind: "videoinput", label: "" },
          { deviceId: "", kind: "audiooutput", label: "" },
          { deviceId: "default", kind: "audiooutput", label: "System Default" },
          {
            deviceId: "communications",
            kind: "audiooutput",
            label: "Communications",
          },
          { deviceId: "speaker-1", kind: "audiooutput", label: "Desk Speakers" },
        ]),
      },
    });

    await expect(listAudioOutputDevices()).resolves.toEqual([
      { deviceId: "speaker-1", label: "Desk Speakers" },
    ]);
  });

  it("requests microphone permission and stops the acquired tracks", async () => {
    const stop = vi.fn();

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop }],
        })),
      },
    });

    await requestAudioInputPermission();

    expect(stop).toHaveBeenCalledTimes(1);
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
