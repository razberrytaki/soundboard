# Manage Pads Mode Design

## Overview

The current hover-based `EDIT` affordance on pad cards is being replaced.

The main reason is interaction priority: in normal use, pads are primarily for playback, not editing. Repeated attempts to place an edit affordance directly on the pad created visual inconsistency, separate hover behavior, and poor discoverability trade-offs.

This change introduces a dedicated `Manage Pads` mode that separates playback from editing.

## Goals

- Keep normal pad interaction focused on playback.
- Make pad editing feel explicit instead of hidden behind hover affordances.
- Remove the current `EDIT` hover label, invisible hit area, and edit-trigger long-press behavior.
- Preserve a quick way to preview audio while editing.

## Interaction Model

### Play Mode

- Default app state.
- Clicking a pad plays its sound.
- No edit affordance is rendered on the pad itself.

### Manage Pads Mode

- Entered from a header action labeled `Manage Pads`.
- The header action changes to `Done` while the mode is active.
- No pad is auto-selected when entering the mode.
- First click on a pad selects it for editing.
- Clicking the currently selected pad again previews/plays it.
- The inspector includes a dedicated `Preview` button for the selected pad.

### Exiting Manage Pads Mode

- Clicking `Done` exits the mode.
- The app returns to normal playback behavior.
- Selection state may be cleared on exit to avoid implying that playback mode still has an active edit target.

## Visual Rules

- Pad cards return to a simple playback-first presentation.
- The selected pad in `Manage Pads` mode receives clear visual emphasis.
- Unselected pads remain visually close to normal playback mode.
- No hover-only edit labels or invisible edit hit areas remain.

## Inspector Behavior

- In `Manage Pads` mode, the right-side inspector acts as the active edit surface for the selected pad.
- The inspector exposes a `Preview` control in addition to the existing save/update workflow.
- Outside `Manage Pads` mode, the inspector returns to its normal create/edit baseline behavior.

## Cleanup Scope

The following interaction experiments should be removed as part of this change:

- hover `EDIT` label
- separate invisible edit hit area
- touch long-press to enter edit mode from a pad

## Testing

Tests should cover:

- play mode pad click plays
- `Manage Pads` enters selection mode
- first click in manage mode selects without playing
- second click on the selected pad plays
- inspector `Preview` plays the selected pad
- `Done` restores normal playback mode
- removed hover/long-press edit behavior is no longer relied on
