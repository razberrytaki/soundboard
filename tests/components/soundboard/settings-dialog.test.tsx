import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsDialog } from "@/components/soundboard/settings-dialog";

function renderSettingsDialog() {
  const onClose = vi.fn();

  render(
    <SettingsDialog
      audioOutputCapabilities={{
        secureContext: true,
        canRouteOutput: true,
        canPromptSelection: false,
        canEnumerateOutputs: true,
        canRequestInputPermission: true,
      }}
      audioOutputDevices={[]}
      audioOutputError={null}
      isChoosingAudioOutput={false}
      isLoadingAudioOutputDevices={false}
      isRequestingAudioPermission={false}
      onAllowConcurrentPlaybackChange={vi.fn()}
      onChooseAudioOutput={vi.fn()}
      onClose={onClose}
      onDefaultPadVolumeChange={vi.fn()}
      onRequestAudioPermission={vi.fn()}
      onResetAudioOutput={vi.fn()}
      onSelectListedAudioOutput={vi.fn()}
      onShowStopAllButtonChange={vi.fn()}
      open
      settings={{
        defaultPadVolume: 100,
        allowConcurrentPlayback: true,
        showStopAllButton: true,
        preferredOutputDeviceId: null,
        preferredOutputDeviceLabel: null,
      }}
    />,
  );

  return { onClose };
}

describe("SettingsDialog", () => {
  it("uses a bounded panel with an internal scrolling body", () => {
    renderSettingsDialog();

    expect(screen.getByTestId("settings-dialog-panel")).toHaveClass(
      "max-h-[calc(100vh-2rem)]",
      "overflow-hidden",
      "flex",
      "flex-col",
    );
    expect(screen.getByTestId("settings-dialog-body")).toHaveClass(
      "min-h-0",
      "overflow-y-auto",
    );
  });

  it("uses a shorter close label and closes from the backdrop or Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSettingsDialog();

    expect(screen.getByRole("button", { name: /^close$/i })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("dialog", { name: /settings/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
