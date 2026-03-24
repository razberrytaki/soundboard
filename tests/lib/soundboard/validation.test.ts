import { describe, expect, it } from "vitest";

import {
  BOARD_NAME_MAX_LENGTH,
  PAD_AUDIO_INVALID_MESSAGE,
  PAD_NAME_MAX_LENGTH,
  PAD_NAME_REQUIRED_MESSAGE,
  normalizeBoardName,
  normalizePadName,
  validateAudioFile,
  validatePadName,
} from "@/lib/soundboard/validation";

describe("soundboard validation", () => {
  it("normalizes board names with trimming, fallback, and max length", () => {
    expect(normalizeBoardName("  Stream  ", "Board 1")).toBe("Stream");
    expect(normalizeBoardName("   ", "Board 1")).toBe("Board 1");
    expect(normalizeBoardName("123456789012345678901", "Board 1")).toHaveLength(
      BOARD_NAME_MAX_LENGTH,
    );
  });

  it("normalizes pad names with trimming and max length", () => {
    expect(normalizePadName("  Laugh  ")).toBe("Laugh");
    expect(normalizePadName("1234567890123")).toHaveLength(PAD_NAME_MAX_LENGTH);
  });

  it("validates pad names as required after trimming", () => {
    expect(validatePadName("   ")).toBe(PAD_NAME_REQUIRED_MESSAGE);
    expect(validatePadName("Laugh")).toBeNull();
  });

  it("only accepts browser-reported audio MIME types", () => {
    expect(
      validateAudioFile(new File(["laugh"], "laugh.mp3", { type: "audio/mpeg" })),
    ).toBeNull();
    expect(
      validateAudioFile(new File(["text"], "notes.txt", { type: "text/plain" })),
    ).toBe(PAD_AUDIO_INVALID_MESSAGE);
  });
});
