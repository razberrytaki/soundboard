# Architecture

## Overview

Soundboard is a browser-based soundboard built as a lightweight web alternative to a hardware streamer deck. Users create boards, attach local audio files to pads, and trigger playback directly in the browser.

The project is intentionally backend-free. Boards, settings, and uploaded audio files are stored locally in the browser and restored when the same user revisits the app on the same device and browser.

## Product Scope

The current application supports:

- Multiple sound boards
- Board creation, renaming, and deletion
- Pad creation, editing, deletion, and manual reordering
- Dedicated `Manage Pads` mode for explicit pad selection, editing, and preview
- Dedicated settings dialog for playback and audio output controls
- Local audio file uploads stored in-browser
- Optional concurrent playback
- Default pad volume plus per-pad volume overrides
- Optional `Stop All` control for active playback
- Progressive-enhancement audio output routing and saved preferred device metadata
- Restoration of the last active board and saved pads on reload

The current scope intentionally excludes:

- User accounts
- Cloud sync
- Server-side storage
- Keyboard shortcuts
- Import and export flows
- Advanced audio editing or mixing features

## Architecture

The app uses a client-centric architecture on top of Next.js App Router.

- Next.js provides the application shell and build pipeline.
- React client components handle board management, pad editing, and playback interaction.
- IndexedDB stores persistent application data in the browser.
- A small local audio player module wraps browser-native `HTMLAudioElement` playback.
- Cloudflare Workers and OpenNext are used for deployment.

There are no API routes or backend services in the current implementation.

## Persistence Model

Persistent data is stored in IndexedDB through a focused local repository layer.

The main stores are:

- `boards`
- `pads`
- `settings`

The app persists:

- board metadata
- pad metadata
- uploaded audio files as `Blob` values
- global settings such as the active board, concurrent playback mode, default pad volume, `Stop All` visibility, and preferred output-device metadata

Persistence is scoped to the same browser on the same device. Data is not expected to transfer across browsers or devices.

## Board and Pad Model

### Boards

Boards are identified by stable IDs, not by display names.

Each board stores:

- `id`
- `name`
- `order`
- `createdAt`
- `updatedAt`

Current board rules:

- Duplicate board names are allowed
- Empty or whitespace-only board names fall back to generated names such as `Board 1`
- Board names are trimmed before save
- Board names are capped at 20 characters in the UI
- Deleting a board with pads requires confirmation

### Pads

Each pad stores:

- `id`
- `boardId`
- `label`
- `color`
- `audioBlob`
- `audioName`
- `mimeType`
- `volumeOverride`
- `order`
- `createdAt`
- `updatedAt`

Current pad rules:

- Pad names are trimmed before save
- Empty or whitespace-only pad names are invalid
- Pad names are capped at 12 characters in the UI
- Uploaded files must be browser-reported `audio/*` types
- `volumeOverride = null` means use the global default pad volume
- a numeric `volumeOverride` is the pad's final playback volume

## UI Structure

The current UI is organized around four primary surfaces:

- Left sidebar
  - board list
  - active board selection
  - create board action
- Main content area
  - active board header
  - board rename and delete actions
  - `Stop All`, `Settings`, `Manage Pads`, and `New Pad` actions
  - sound pad grid
  - playback-first pad presentation with selected-pad emphasis during management
- Settings dialog
  - default pad volume
  - concurrent playback
  - `Stop All` visibility
  - audio output support state
  - preferred output device selection and reset
- Inspector panel
  - default create-pad workflow in normal play mode
  - selection prompt when `Manage Pads` is active without a selected pad
  - pad editing for the selected pad in `Manage Pads` mode
  - color and audio selection
  - pad-level volume override
  - preview, reorder, and delete controls for existing pads

The main workspace keeps the inspector visible beside the grid. Unsaved pad edits are guarded before switching boards, changing modes, or targeting another pad.

Pad interaction rules are intentionally split by intent:

- in normal play mode, clicking or tapping a pad plays it immediately
- editing is entered from the header-level `Manage Pads` action rather than from a pad-local affordance
- in `Manage Pads` mode, the first click selects a pad for editing
- clicking the selected pad again previews/plays it
- the inspector also exposes a dedicated `Preview` action while editing an existing pad
- leaving `Manage Pads` returns the grid to normal playback behavior

## Playback Model

Playback uses browser-native audio objects created from stored `Blob` values.

The playback module supports:

- single sound playback
- concurrent playback when enabled
- stopping previous playback when concurrent mode is disabled
- effective volume resolution from `pad.volumeOverride ?? settings.defaultPadVolume`
- optional `Stop All` cleanup through the active player set
- cleanup of object URLs after playback ends or fails

Audio output routing is progressive enhancement only. The runtime prefers the browser's native device picker when available, can fall back to enumerated output-device lists in browsers that support routing without the picker, and otherwise stays on the system default output. Some browsers may require temporary microphone permission before they expose more output devices for selection.

## Deployment Notes

This repository is deployed with Cloudflare Workers using OpenNext.

Important deployment assumptions:

- `wrangler.jsonc` should remain fork-friendly and not include project-specific private configuration by default
- project-specific routes and custom domains should be configured per deployment environment
- the production workflow expects `main` to be the deployment branch

Typical Cloudflare build setup:

- Build command: `pnpm exec opennextjs-cloudflare build`
- Deploy command: `pnpm exec opennextjs-cloudflare deploy`
