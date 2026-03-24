# Soundboard Design

Date: 2026-03-24
Status: Approved for planning

## Overview

This project is a web-based soundboard that behaves like a lightweight streamer deck in the browser. Users can create multiple boards, assign sound effects to pads, and trigger playback by clicking pads in the UI.

The project will avoid a backend and should preserve user configuration and uploaded sounds when the user revisits the app later. Persistence only needs to work for the same browser on the same device.

## Constraints

- Frontend framework: Next.js 16.2.1
- Runtime: Node.js v24.13.0
- Package manager: pnpm
- Styling: Tailwind CSS
- Backend: none
- Persistence target: same browser + same device
- Dependency policy: keep dependencies minimal and prefer built-in browser and framework features

## Goals

- Let users create and manage multiple soundboards
- Let users upload local audio files and bind them to pads
- Let users click pads to play sounds from the browser
- Preserve boards, pad settings, and uploaded audio across page revisits
- Provide a global setting for whether multiple sounds can play at the same time

## Non-Goals For V1

- User accounts or cloud sync
- Cross-device or cross-browser synchronization
- Server-side storage or upload APIs
- Keyboard shortcuts
- Multiple pages or banks inside a board
- Import/export
- Advanced audio controls beyond basic playback
- Mandatory offline/PWA installation support

## Chosen Approach

The app will use a client-centric architecture in Next.js App Router. All board editing, sound playback, and persistence will happen in the browser. No server API routes are required for V1.

User data will be stored in IndexedDB. This includes board metadata, pad metadata, and the uploaded audio files as Blob values. This approach was chosen because it works across major browsers more reliably than OPFS-centered approaches and does not require additional infrastructure.

Audio playback will use browser-native `HTMLAudioElement` instances. This keeps the implementation small and aligned with the dependency-minimization requirement.

## Information Architecture

The primary layout is a management-focused two-column interface.

- Left sidebar:
  - Board list
  - Active board indicator
  - Create board action
- Main content area:
  - Current board title
  - Sound pad grid
  - Add pad action
  - Entry points for edit actions
- Global settings entry:
  - Toggle for concurrent playback

On smaller screens, the board list can collapse into a drawer or overlay, but the conceptual model remains the same.

## Core User Flows

### 1. Launch And Restore

1. User opens the app.
2. The app loads global settings from IndexedDB.
3. The app restores the last active board.
4. The app loads pads for that board and renders them immediately.

### 2. Create And Switch Boards

1. User creates a new board from the sidebar.
2. The new board is persisted immediately.
3. User selects a board from the sidebar.
4. The selected board becomes the active board and is stored in global settings.

### 3. Create Or Edit A Pad

1. User chooses the add or edit action.
2. A local edit surface opens in the current page context, such as a modal or side panel.
3. User uploads an audio file.
4. User sets pad label and color.
5. User saves changes.
6. Pad metadata and the audio Blob are stored in IndexedDB.

### 4. Reorder Or Delete A Pad

1. User enters edit mode or uses explicit management actions.
2. User changes pad order or removes a pad.
3. The updated order or deletion is persisted immediately.

### 5. Play Audio

1. User clicks a pad.
2. The app resolves the stored audio Blob and creates an object URL or equivalent playback source.
3. The app plays the sound.
4. If concurrent playback is disabled, existing playback is stopped before the new sound starts.

## Data Model

The initial IndexedDB schema is intentionally small.

### `boards`

- `id`
- `name`
- `createdAt`
- `updatedAt`

### `pads`

- `id`
- `boardId`
- `label`
- `color`
- `audioBlob`
- `audioName`
- `mimeType`
- `order`
- `createdAt`
- `updatedAt`

### `settings`

- `activeBoardId`
- `allowConcurrentPlayback`

## State And Persistence Strategy

- React state manages the current UI session
- IndexedDB stores durable data
- The app hydrates from IndexedDB on load
- Changes to boards, pads, order, and settings are persisted immediately after the user confirms an edit
- The active board is restored from `settings.activeBoardId`

The implementation should isolate IndexedDB access behind a small local data module so UI code does not directly embed storage operations.

## UI Behavior

- Pads are the primary interaction target in the main panel
- Each pad shows at least a label and a visual color identity
- Editing a pad does not require route navigation
- Empty states should clearly guide users to create a board or add a sound
- Errors such as unsupported file load or playback failure should be surfaced in a lightweight inline way

## Browser Compatibility Direction

The app should target major current browsers, including Chromium-based browsers, Safari, and Firefox, as far as the chosen browser APIs allow. Because persistence only needs to work within the same browser on the same device, IndexedDB is the preferred storage layer.

No requirement exists for cross-browser portability of stored data.

## Risks And Mitigations

### IndexedDB Complexity

Risk: Client-side persistence code can become brittle if storage access is scattered.

Mitigation: Keep all IndexedDB access in a small focused module with clear CRUD helpers and versioned schema setup.

### Audio Blob Size

Risk: Large or numerous uploaded files may stress browser storage quotas.

Mitigation: V1 should document that storage depends on browser limits and should keep error handling explicit when writes fail.

### Playback Lifecycle

Risk: Concurrent versus single playback can create inconsistent behavior if audio instances are not tracked centrally.

Mitigation: Maintain a small playback manager responsible for currently active audio instances.

## Acceptance Criteria

- A user can create more than one board
- A user can switch between boards
- A user can add a pad with an uploaded audio file
- A user can edit pad label and color
- A user can reorder and delete pads
- Clicking a pad plays its audio
- Reloading or revisiting the app in the same browser restores saved boards, pads, audio, and the last active board
- A global concurrent playback setting changes whether sounds overlap or replace each other

## Initial Implementation Boundaries

V1 should use only Next.js, Tailwind, React, and browser APIs unless a concrete implementation blocker appears. Additional libraries for state management, audio playback, or IndexedDB abstraction are intentionally excluded from the starting plan.
