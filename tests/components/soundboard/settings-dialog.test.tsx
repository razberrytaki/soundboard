import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsDialog } from "@/components/soundboard/settings-dialog";

function renderSettingsDialog() {
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
      onClose={vi.fn()}
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
});
