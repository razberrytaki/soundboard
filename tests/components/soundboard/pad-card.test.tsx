import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    volumeOverride: null,
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

  it("uses a single edit action label instead of a separate play label", () => {
    render(
      <PadCard
        onEdit={vi.fn()}
        onPlay={vi.fn()}
        pad={createPad()}
      />,
    );

    expect(screen.queryByText("Play")).not.toBeInTheDocument();

    const editAction = screen.getByRole("button", {
      name: /edit very long pad name/i,
    });
    expect(editAction).toHaveClass("opacity-0");
    expect(editAction).toHaveClass("pointer-events-none");
    expect(editAction).toHaveClass("peer-hover:pointer-events-auto");
    expect(editAction).toHaveClass("peer-hover:opacity-100");
    expect(editAction).toHaveClass("hover:pointer-events-auto");
    expect(editAction).toHaveClass("hover:opacity-100");
    expect(editAction).toHaveClass("transition-opacity");
    expect(editAction).not.toHaveClass("peer-hover:-translate-y-1");
    expect(editAction).not.toHaveClass("peer-focus-visible:-translate-y-1");
    expect(editAction).not.toHaveClass("hover:text-white");
  });

  it("renders edit as a lightweight text action instead of a pill button", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onPlay = vi.fn();

    render(<PadCard onEdit={onEdit} onPlay={onPlay} pad={createPad()} />);

    const editAction = screen.getByRole("button", {
      name: /edit very long pad name/i,
    });
    expect(editAction).toHaveClass("font-[family-name:var(--font-mono)]");
    expect(editAction).toHaveClass("text-[0.65rem]");
    expect(editAction).toHaveClass("text-white/72");
    expect(editAction).not.toHaveClass("rounded-full");
    expect(editAction).not.toHaveClass("border");
    expect(editAction).not.toHaveClass("bg-[rgba(24,18,14,0.52)]");

    await user.click(editAction);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });
});
