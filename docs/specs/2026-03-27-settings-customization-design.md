# Settings Customization Design

Date: 2026-03-27

## Overview

This document defines the first expansion of the soundboard settings experience.

The current app only supports one global playback setting: `allowConcurrentPlayback`.
The new design adds a dedicated settings surface and separates:

- app-wide playback defaults
- browser-dependent audio output behavior
- per-pad volume overrides

The goal is to let users tune playback behavior without introducing a backend or account sync model. All settings remain local to the current browser and device.

## Product Goals

- Add a dedicated settings entry point instead of growing the small inline settings control in the header.
- Let users choose a default playback volume for pads.
- Let users override volume on individual pads when needed.
- Let users control core playback behavior from one place.
- Expose audio output device selection where the browser supports it.
- Provide clear fallback UX where audio output selection is unavailable.

## Non-Goals

- Board-specific settings
- Per-pad playback behavior overrides beyond volume
- Loop playback
- Cross-device sync
- Real-time volume changes for sounds that are already playing

## User-Facing Scope

### Global Settings

The settings panel will manage these app-wide values:

- `Audio Output`
- `Default Pad Volume`
- `Allow Concurrent Playback`
- `Show Stop All Button`

### Pad-Level Settings

The pad editor will manage one pad-specific playback value:

- `Use default volume`
- `Custom pad volume` when the default is disabled

## UX Design

### Settings Entry Point

The current compact `SettingsPanel` in the header will be replaced by a `Settings` button.

Selecting the button opens a dedicated settings surface. The surface can be implemented as a modal, sheet, or panel during implementation planning, but it must be visually separated from pad editing.

This keeps:

- app configuration in one place
- pad editing focused on pad-specific content
- room for future settings growth

### Audio Output Section

The `Audio Output` section must always be visible so the feature is discoverable.

#### Supported Browsers

If the environment supports output device selection:

- show `System Default`
- show a `Choose Device...` action
- show the currently selected device label when available

The user flow is:

1. open settings
2. choose `Choose Device...`
3. let the browser prompt for device selection
4. save the selected device ID and label locally

#### Unsupported Browsers

If the environment does not support the required APIs, the section remains visible but disabled.

The UI must explain why:

- output device selection is only supported in some browsers
- a secure context may be required
- user interaction may be required before the browser allows device selection
- unsupported browsers will use the system default output device

#### Restoring Saved Device Selection

The app should attempt to restore the saved output device when possible.

If restoration fails because:

- the device is no longer available
- permission is no longer granted
- the browser no longer supports the feature

then the app must fall back to `System Default` and show a non-blocking status message in the settings UI.

### Volume Controls

#### Global Volume

The global volume setting should be named `Default Pad Volume`, not `Master Volume`.

This is a semantic choice:

- `Master Volume` implies a final gain layer that affects all sounds after pad-specific settings
- `Default Pad Volume` communicates that it is the default value used unless a pad opts out

The control is a `0–100%` slider.

#### Pad Volume

Each pad gets a `Use default volume` toggle in the pad editor.

- when enabled, the pad uses the global `Default Pad Volume`
- when disabled, a `0–100%` slider appears and the pad stores its own final playback volume

Pad volume is a final absolute value, not a multiplier on top of the global default.

This avoids a confusing dual-adjustment model where users would have to combine global and pad-level values to predict the actual result.

#### Volume Application Timing

Volume changes apply only to sounds that start after the change.

Already playing sounds keep the volume they started with. This keeps the first implementation simpler and avoids retrofitting live volume updates into the current audio player lifecycle.

### Playback Behavior

The settings panel also manages:

- `Allow Concurrent Playback`
- `Show Stop All Button`

`Allow Concurrent Playback` remains a global behavior toggle.

`Show Stop All Button` controls whether a header-level `Stop All` action is visible. The button, when shown, stops every currently playing sound.

The button is only shown or hidden. Its location remains fixed in the header.

## Data Model

### Global Settings

`SoundboardSettings` should expand from:

- `activeBoardId`
- `allowConcurrentPlayback`

to include:

- `activeBoardId: string | null`
- `allowConcurrentPlayback: boolean`
- `defaultPadVolume: number`
- `showStopAllButton: boolean`
- `preferredOutputDeviceId: string | null`
- `preferredOutputDeviceLabel: string | null`

Recommended defaults:

- `defaultPadVolume = 100`
- `showStopAllButton = true`
- `preferredOutputDeviceId = null`
- `preferredOutputDeviceLabel = null`

### Pad Model

`SoundboardPad` should add:

- `volumeOverride: number | null`

Interpretation:

- `null` means use the global default volume
- `0–100` means use this pad-specific final volume

The existing audio file model remains unchanged.

## Runtime Behavior

### Determining Effective Volume

When a pad is played:

- if `pad.volumeOverride` is not `null`, use that value
- otherwise use `settings.defaultPadVolume`

The selected value is normalized to the audio element volume range during playback.

### Output Device Routing

The current player creates a fresh `Audio` instance for each playback. Because of that, output routing must be applied at the time each playback instance is created.

Implementation should therefore treat output routing as a playback-time concern:

- resolve the preferred device before playback
- apply it to the newly created audio element when supported
- gracefully fall back to the default sink when not supported or when the assignment fails

## Browser Support Expectations

This feature set should continue to target major browsers in general, but the output-device subfeature is explicitly progressive enhancement.

Expected policy:

- settings panel works everywhere
- volume and playback behavior settings work everywhere
- output device selection works only where browser APIs allow it
- unsupported environments receive explanation, not a broken or missing control

## Error Handling

- Invalid or unavailable saved output device should not block playback.
- Failure to apply a chosen sink should fall back to the system default device.
- Output device selection cancellation should leave the previous setting unchanged.
- Settings changes should be persisted independently so one failed subfeature does not roll back unrelated values.

## Testing Expectations

Implementation should cover:

- default settings persistence and restoration
- pad volume override persistence and restoration
- `Stop All` visibility toggle
- effective volume selection rules
- supported and unsupported output-device UI states
- saved output-device restore failure fallback
- existing playback concurrency behavior regression coverage

Tests should favor behavior-level checks over internal implementation details.

## Open Questions Resolved

- Output device selection is included as a progressive enhancement feature.
- Global volume is modeled as a default value, not as a master multiplier.
- Pad-level volume is the only pad-specific playback override in this iteration.
- Volume changes only affect future playback instances.
