import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("renders a passive-looking EDIT label plus a separate edit button", () => {
    render(
      <PadCard
        onEdit={vi.fn()}
        onPlay={vi.fn()}
        pad={createPad()}
      />,
    );

    expect(screen.queryByText("Play")).not.toBeInTheDocument();
    const editLabel = screen.getByText("Edit");
    expect(editLabel.parentElement).toHaveClass("pointer-events-none");
    expect(editLabel).toHaveClass("font-[family-name:var(--font-mono)]");

    const editAction = screen.getByRole("button", {
      name: /edit very long pad name/i,
    });
    expect(editAction).toHaveClass("absolute");
    expect(editAction).toHaveClass("right-3");
    expect(editAction).toHaveClass("top-2");
    expect(editAction).toHaveClass("h-8");
    expect(editAction).toHaveClass("w-20");
  });

  it("clicking the edit hit area edits without playing", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onPlay = vi.fn();

    render(<PadCard onEdit={onEdit} onPlay={onPlay} pad={createPad()} />);

    const editAction = screen.getByRole("button", {
      name: /edit very long pad name/i,
    });

    await user.click(editAction);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("supports keyboard focus on the edit hit area", async () => {
    const user = userEvent.setup();

    render(
      <PadCard
        onEdit={vi.fn()}
        onPlay={vi.fn()}
        pad={createPad()}
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: /^very long pad name$/i }),
    ).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole("button", { name: /edit very long pad name/i }),
    ).toHaveFocus();
  });

  it("opens edit on touch long press without playing", () => {
    vi.useFakeTimers();
    const onEdit = vi.fn();
    const onPlay = vi.fn();

    render(<PadCard onEdit={onEdit} onPlay={onPlay} pad={createPad()} />);

    const padButton = screen.getByRole("button", {
      name: /^very long pad name$/i,
    });

    fireEvent.pointerDown(padButton, { pointerType: "touch" });
    vi.advanceTimersByTime(450);
    fireEvent.pointerUp(padButton, { pointerType: "touch" });
    fireEvent.click(padButton);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("still plays on a short touch tap", () => {
    vi.useFakeTimers();
    const onEdit = vi.fn();
    const onPlay = vi.fn();

    render(<PadCard onEdit={onEdit} onPlay={onPlay} pad={createPad()} />);

    const padButton = screen.getByRole("button", {
      name: /^very long pad name$/i,
    });

    fireEvent.pointerDown(padButton, { pointerType: "touch" });
    vi.advanceTimersByTime(200);
    fireEvent.pointerUp(padButton, { pointerType: "touch" });
    fireEvent.click(padButton);

    expect(onEdit).not.toHaveBeenCalled();
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
