import type { SoundboardSettings } from "@/lib/soundboard/types";

export const defaultSoundboardSettings: SoundboardSettings = {
  activeBoardId: null,
  allowConcurrentPlayback: true,
  defaultPadVolume: 100,
  showStopAllButton: true,
  preferredOutputDeviceId: null,
  preferredOutputDeviceLabel: null,
};
