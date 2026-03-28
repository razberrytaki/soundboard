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
        isManaging={false}
        isSelected={false}
        onPlay={vi.fn()}
        onSelect={vi.fn()}
        pad={createPad()}
      />,
    );

    expect(screen.getByText("Very Long Pad Name")).toHaveClass("line-clamp-2");
    expect(screen.getByText("Very Long Pad Name")).toHaveClass("text-center");
  });

  it("plays immediately in play mode", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    const onSelect = vi.fn();

    render(
      <PadCard
        isManaging={false}
        isSelected={false}
        onPlay={onPlay}
        onSelect={onSelect}
        pad={createPad()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^very long pad name$/i }),
    );

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects without playing on the first click in manage mode", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    const onSelect = vi.fn();

    render(
      <PadCard
        isManaging
        isSelected={false}
        onPlay={onPlay}
        onSelect={onSelect}
        pad={createPad()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^very long pad name$/i }),
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("plays on click when the pad is already selected in manage mode", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    const onSelect = vi.fn();

    render(
      <PadCard
        isManaging
        isSelected
        onPlay={onPlay}
        onSelect={onSelect}
        pad={createPad()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^very long pad name$/i }),
    );

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("visually emphasizes the selected pad in manage mode", () => {
    render(
      <PadCard
        isManaging
        isSelected
        onPlay={vi.fn()}
        onSelect={vi.fn()}
        pad={createPad()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^very long pad name$/i }),
    ).toHaveClass("ring-2");
  });
});
