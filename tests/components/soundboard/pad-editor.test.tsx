import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PadEditor } from "@/components/soundboard/pad-editor";
import type { SoundboardPad } from "@/lib/soundboard/types";

function createPad(overrides: Partial<SoundboardPad> = {}): SoundboardPad {
  return {
    id: "pad-1",
    boardId: "board-1",
    label: "Airhorn",
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

function renderPadEditor(
  overrides: Partial<React.ComponentProps<typeof PadEditor>> = {},
) {
  const onDirtyChange = vi.fn();
  const onDelete = vi.fn();
  const onMoveDown = vi.fn();
  const onMoveUp = vi.fn();
  const onSave = vi.fn(async () => undefined);

  render(
    <PadEditor
      canMoveDown={false}
      canMoveUp={false}
      mode="create"
      onDelete={onDelete}
      onDirtyChange={onDirtyChange}
      onMoveDown={onMoveDown}
      onMoveUp={onMoveUp}
      onSave={onSave}
      pad={null}
      {...overrides}
    />,
  );

  return { onDelete, onDirtyChange, onMoveDown, onMoveUp, onSave };
}

describe("PadEditor", () => {
  it("clears a create-mode audio selection when a later upload is invalid", async () => {
    const user = userEvent.setup({ applyAccept: false });

    renderPadEditor();

    const input = screen.getByLabelText(/audio file/i);

    await user.upload(
      input,
      new File(["laugh"], "laugh.mp3", { type: "audio/mpeg" }),
    );
    expect(screen.getByText("laugh.mp3")).toBeInTheDocument();

    await user.upload(
      input,
      new File(["note"], "note.txt", { type: "text/plain" }),
    );

    expect(screen.queryByText("laugh.mp3")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/choose an audio file/i);
    expect(screen.getByRole("button", { name: /save pad/i })).toBeDisabled();
  });

  it("keeps the existing edit-mode audio metadata when a later upload is invalid", async () => {
    const user = userEvent.setup({ applyAccept: false });

    renderPadEditor({
      canMoveDown: true,
      canMoveUp: true,
      mode: "edit",
      pad: createPad(),
    });

    const input = screen.getByLabelText(/audio file/i);

    expect(screen.getByText("airhorn.mp3")).toBeInTheDocument();

    await user.upload(
      input,
      new File(["note"], "note.txt", { type: "text/plain" }),
    );

    expect(screen.getByText("airhorn.mp3")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/choose an audio file/i);
  });

  it("ignores file input changes when no file is selected", () => {
    renderPadEditor();

    fireEvent.change(screen.getByLabelText(/audio file/i), {
      target: { files: [] },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/\.mp3$/i)).not.toBeInTheDocument();
  });

  it("reports dirty state when only the color value changes", async () => {
    const { onDirtyChange } = renderPadEditor({
      mode: "edit",
      pad: createPad(),
    });

    fireEvent.change(screen.getByLabelText(/color/i), {
      target: { value: "#34645e" },
    });

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});
