import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PadCard } from "@/components/soundboard/pad-card";
import type { SoundboardPad } from "@/lib/soundboard/types";

function createPad(overrides: Partial<SoundboardPad> = {}): SoundboardPad {
  return {
    id: "pad-1",
    boardId: "board-1",
    label: "Very Long Pad Name",
    color: "#d95b43",
    order: 1,
    audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
    audioName: "airhorn.mp3",
    mimeType: "audio/mpeg",
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("PadCard", () => {
  it("centers the pad name and clamps it to two lines", () => {
    render(
      <PadCard
        onEdit={vi.fn()}
        onPlay={vi.fn()}
        pad={createPad()}
      />,
    );

    expect(screen.getByText("Very Long Pad Name")).toHaveClass("line-clamp-2");
    expect(screen.getByText("Very Long Pad Name")).toHaveClass("text-center");
  });

  it("only reveals the play label on hover or focus", () => {
    render(
      <PadCard
        onEdit={vi.fn()}
        onPlay={vi.fn()}
        pad={createPad()}
      />,
    );

    expect(screen.getByText("Play")).toHaveClass("opacity-0");
    expect(screen.getByText("Play")).toHaveClass("group-hover:opacity-100");
    expect(screen.getByText("Play")).toHaveClass("group-focus-visible:opacity-100");
  });
});
