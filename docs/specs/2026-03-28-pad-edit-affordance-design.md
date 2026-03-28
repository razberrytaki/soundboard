# Pad Edit Affordance Design

Date: 2026-03-28

## Overview

This document redesigns how users enter pad editing from the soundboard grid.

The current implementation uses a separate hover-time `Edit` button layered over
each pad. It works functionally, but it still feels visually detached from the
pad itself. The goal of this design is to preserve the soundboard rule that pad
clicks should play audio, while making edit entry feel like part of the pad
instead of a floating secondary control.

## Product Goals

- Keep playback as the default primary action for each pad.
- Replace the current detached hover `Edit` button with a more unified pad-level
  affordance.
- Preserve clear edit access on desktop without reintroducing a row of buttons
  under every pad.
- Provide a touch-friendly edit path for non-hover devices.
- Maintain keyboard access and screen-reader clarity.

## Non-Goals

- Adding a global edit mode
- Reintroducing a dedicated `Edit` button below each pad
- Changing the inspector structure or pad editor form
- Adding icons, badges, or additional pad actions

## User-Facing Scope

### Desktop

On desktop and other hover-capable environments:

- the pad still plays when the pad body is clicked
- `Edit` appears as a small corner label in the pad on hover/focus
- the label should feel visually attached to the pad, not like a floating pill
- editing is triggered through a small top-right interaction zone associated
  with the label

### Touch Devices

On touch devices:

- a short tap still plays the pad
- a long press enters edit mode
- when long press succeeds, playback must not fire

## UX Design

### Desktop Edit Affordance

The chosen desktop direction is the `corner label` treatment.

The visual layer should look like a passive pad label:

- small uppercase `EDIT`
- top-right placement
- no badge, pill, border, or separate button chrome
- almost hidden at rest
- visible on pad hover/focus

This is intentionally closer to the old `PLAY` label than to a normal action
button. The affordance should feel embedded in the pad surface.

### Visual and Interactive Separation

The `EDIT` text should not be the sole interactive target.

Instead, the implementation should separate:

- a visual label layer
- a small invisible or near-invisible hit area in the same top-right zone

This avoids making the label itself carry all visual and interaction
responsibility. The user sees a quiet pad label, while the app still preserves a
reliable click target and keyboard focus target.

### Motion Rules

The pad card remains the only strongly animated object.

The `EDIT` affordance should not introduce its own distinct motion vocabulary.
Its behavior should follow these rules:

- the pad may translate on hover as it already does
- the `EDIT` label may fade in and out
- the `EDIT` label should not bounce, shift independently, or change into a
  separate visual state on its own
- the label should feel synchronized with the pad, not animated separately

### Mobile Long Press

Touch environments need an edit path without hover.

The interaction model is:

- short tap: play
- long press: edit
- moving away or releasing early: cancel long press

Implementation should favor a single predictable threshold instead of gesture
complexity. When long press wins, the play action must be suppressed.

## Accessibility

The visual treatment may resemble a passive label, but the actual edit affordance
must remain accessible.

Requirements:

- the edit target remains a real `button`
- it must have an accessible name such as `Edit <pad label>`
- it must be keyboard-focusable
- focus state must still be visible, even if subtle
- screen readers must continue to distinguish play and edit actions

The click target should be slightly larger than the rendered label, but not so
large that it interferes with expected pad playback clicks.

## Component Impact

### `PadCard`

`PadCard` is the primary implementation surface.

Expected responsibilities:

- render the pad play button
- render the passive-looking `EDIT` label layer
- render the associated edit hit area
- manage hover/focus presentation rules
- manage long-press timing for touch editing

### Upstream Behavior

The higher-level soundboard behavior remains unchanged:

- `onPlay(pad)` still handles playback
- `onEdit(pad)` still opens the inspector in edit mode

No change is needed to board state, persistence, or pad data structures.

## Testing Expectations

The updated test suite should lock the following behavior:

- `PLAY` is no longer rendered
- the desktop `EDIT` affordance exists
- edit activation does not trigger playback
- the visual affordance uses the unified label treatment instead of pill/badge
  chrome
- the edit target remains keyboard focusable
- long press enters edit mode on touch-style interaction
- short tap still plays on touch-style interaction

## Implementation Notes

The safest implementation approach is:

1. redesign `PadCard` markup so the visible label and hit area are separate
2. keep the edit target as a button
3. add long-press handling only inside `PadCard`
4. add focused component tests before any broader integration tests

This keeps the change tightly scoped and avoids churn in unrelated soundboard
logic.
