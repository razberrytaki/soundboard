# Settings Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated settings surface with global playback controls, optional pad-level volume overrides, and progressive-enhancement audio output selection without regressing local persistence or playback behavior.

**Architecture:** Keep the app client-only and extend the existing IndexedDB schema instead of introducing new storage layers. Add a focused settings dialog component, keep pad-specific volume editing inside the existing inspector, and teach the audio player to accept per-playback volume and optional output-device routing with graceful fallback behavior.

**Tech Stack:** Next.js 16.2.1 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, IndexedDB

---

## File Structure

### Existing files to modify

- `lib/soundboard/types.ts`
- `lib/soundboard/defaults.ts`
- `lib/soundboard/db.ts`
- `lib/soundboard/audio-player.ts`
- `components/soundboard/soundboard-app.tsx`
- `components/soundboard/pad-editor.tsx`
- `tests/lib/soundboard/db.test.ts`
- `tests/lib/soundboard/audio-player.test.ts`
- `tests/components/soundboard/pad-editor.test.tsx`
- `tests/components/soundboard/soundboard-app.test.tsx`
- `tests/components/soundboard/soundboard-app.persistence.test.tsx`
- `README.md`
- `docs/architecture.md`

### New files to create

- `lib/soundboard/audio-output.ts`
- `components/soundboard/settings-dialog.tsx`
- `tests/lib/soundboard/audio-output.test.ts`

### Existing files to remove after replacement

- `components/soundboard/settings-panel.tsx`

## Implementation Notes

- Keep the settings data model flat. Do not add board-level settings.
- Bump the IndexedDB version and migrate missing fields with defaults.
- Keep `defaultPadVolume` and `volumeOverride` in `0–100` form in storage. Convert to `0–1` only at playback time.
- Treat audio output selection as progressive enhancement. Unsupported browsers must still render a clear explanation.
- Do not add live volume updates for already-playing sounds in this iteration.
- Favor behavior-level tests over implementation-detail assertions.

### Task 1: Extend the Settings and Pad Storage Model

**Files:**
- Modify: `lib/soundboard/types.ts`
- Modify: `lib/soundboard/defaults.ts`
- Modify: `lib/soundboard/db.ts`
- Test: `tests/lib/soundboard/db.test.ts`

- [ ] **Step 1: Write the failing repository tests**

Add coverage for the new persisted fields:

```ts
expect(await db.getSettings()).toEqual({
  activeBoardId: null,
  allowConcurrentPlayback: true,
  defaultPadVolume: 100,
  showStopAllButton: true,
  preferredOutputDeviceId: null,
  preferredOutputDeviceLabel: null,
});

expect(savedPad.volumeOverride).toBe(35);
expect(updatedPad.volumeOverride).toBeNull();
```

- [ ] **Step 2: Run the repository tests to verify failure**

Run: `pnpm exec vitest run tests/lib/soundboard/db.test.ts`

Expected: FAIL because the new settings and pad fields do not exist yet.

- [ ] **Step 3: Implement the minimal schema and migration changes**

Add the new types and defaults:

```ts
export type SoundboardSettings = {
  activeBoardId: string | null;
  allowConcurrentPlayback: boolean;
  defaultPadVolume: number;
  showStopAllButton: boolean;
  preferredOutputDeviceId: string | null;
  preferredOutputDeviceLabel: string | null;
};

export type SoundboardPad = {
  // existing fields...
  volumeOverride: number | null;
};
```

Then update IndexedDB persistence:

```ts
const DATABASE_VERSION = 2;

const nextSettings = {
  key: SETTINGS_KEY,
  ...defaultSoundboardSettings,
  ...existingSettings,
  ...input,
};
```

For pad saves, preserve or overwrite `volumeOverride` explicitly instead of dropping it on update.

- [ ] **Step 4: Re-run the repository tests**

Run: `pnpm exec vitest run tests/lib/soundboard/db.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the storage-model slice**

```bash
git add lib/soundboard/types.ts lib/soundboard/defaults.ts lib/soundboard/db.ts tests/lib/soundboard/db.test.ts
git commit -m "Add persisted settings and pad volume fields"
```

### Task 2: Add Playback-Time Volume and Audio Output Routing

**Files:**
- Create: `lib/soundboard/audio-output.ts`
- Modify: `lib/soundboard/audio-player.ts`
- Test: `tests/lib/soundboard/audio-output.test.ts`
- Test: `tests/lib/soundboard/audio-player.test.ts`

- [ ] **Step 1: Write the failing runtime tests**

Cover the new runtime behavior:

```ts
await player.play(blob, { volume: 0.35, outputDeviceId: "speaker-1" });
expect(audio.volume).toBe(0.35);
expect(audio.setSinkId).toHaveBeenCalledWith("speaker-1");

await player.play(blob, { volume: 1, outputDeviceId: "speaker-1" });
expect(audio.play).toHaveBeenCalled();
```

Also add tests for:

- unsupported `setSinkId`
- `setSinkId` rejection fallback
- output-support feature detection helpers

- [ ] **Step 2: Run the runtime tests to verify failure**

Run: `pnpm exec vitest run tests/lib/soundboard/audio-output.test.ts tests/lib/soundboard/audio-player.test.ts`

Expected: FAIL because the helper module and playback options do not exist yet.

- [ ] **Step 3: Implement minimal output and volume runtime support**

Add a small helper module:

```ts
export function supportsAudioOutputSelection() {
  return typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.selectAudioOutput === "function";
}
```

Extend the player contract:

```ts
type PlaybackOptions = {
  volume: number;
  outputDeviceId?: string | null;
};

await player.play(blob, { volume, outputDeviceId });
```

Inside the player:

- clamp `0–100`-derived values to `0–1`
- set `audio.volume`
- attempt `audio.setSinkId()` only when supported and requested
- swallow sink assignment failures and continue playback on the default device

- [ ] **Step 4: Re-run the runtime tests**

Run: `pnpm exec vitest run tests/lib/soundboard/audio-output.test.ts tests/lib/soundboard/audio-player.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the playback runtime slice**

```bash
git add lib/soundboard/audio-output.ts lib/soundboard/audio-player.ts tests/lib/soundboard/audio-output.test.ts tests/lib/soundboard/audio-player.test.ts
git commit -m "Add playback volume and output routing support"
```

### Task 3: Replace the Inline Settings Panel with a Dedicated Settings Dialog

**Files:**
- Create: `components/soundboard/settings-dialog.tsx`
- Modify: `components/soundboard/soundboard-app.tsx`
- Delete: `components/soundboard/settings-panel.tsx`
- Test: `tests/components/soundboard/soundboard-app.test.tsx`

- [ ] **Step 1: Write the failing app tests for the new settings surface**

Add behavior tests for:

- opening and closing the settings dialog
- changing `Default Pad Volume`
- toggling `Allow Concurrent Playback`
- toggling `Show Stop All Button`
- seeing the unsupported browser explanation
- seeing a `Stop All` button only when enabled

Example:

```ts
await user.click(screen.getByRole("button", { name: /settings/i }));
expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();

await user.click(screen.getByRole("checkbox", { name: /show stop all button/i }));
expect(screen.queryByRole("button", { name: /stop all/i })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the app tests to verify failure**

Run: `pnpm exec vitest run tests/components/soundboard/soundboard-app.test.tsx`

Expected: FAIL because the settings dialog, stop-all toggle, and new controls do not exist.

- [ ] **Step 3: Implement the dialog and app wiring**

Create a focused settings component:

```tsx
<SettingsDialog
  isOpen={isSettingsOpen}
  settings={settings}
  audioOutputState={audioOutputState}
  onClose={handleSettingsClose}
  onUpdateSettings={handleSettingsUpdate}
  onChooseOutputDevice={handleChooseOutputDevice}
/>
```

In `SoundboardApp`:

- replace the compact `SettingsPanel` with a `Settings` trigger button
- render a header-level `Stop All` button only when `showStopAllButton` is true
- call `playerInstance.stopAll()` from that button
- route settings updates through `repository.updateSettings()`
- load and expose audio-output support state for the dialog

- [ ] **Step 4: Re-run the app tests**

Run: `pnpm exec vitest run tests/components/soundboard/soundboard-app.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the settings-dialog slice**

```bash
git add components/soundboard/settings-dialog.tsx components/soundboard/soundboard-app.tsx tests/components/soundboard/soundboard-app.test.tsx
git rm components/soundboard/settings-panel.tsx
git commit -m "Add dedicated settings dialog"
```

### Task 4: Add Pad-Level Volume Override Controls

**Files:**
- Modify: `components/soundboard/pad-editor.tsx`
- Modify: `components/soundboard/soundboard-app.tsx`
- Modify: `lib/soundboard/types.ts`
- Test: `tests/components/soundboard/pad-editor.test.tsx`
- Test: `tests/components/soundboard/soundboard-app.persistence.test.tsx`

- [ ] **Step 1: Write the failing pad-editor and persistence tests**

Add tests for:

- `Use default volume` checked by default on new pads
- revealing a slider when the toggle is disabled
- persisting a custom pad volume across edit and remount
- falling back to the global default when `volumeOverride` is `null`

Example:

```ts
await user.click(screen.getByRole("checkbox", { name: /use default volume/i }));
expect(screen.getByRole("slider", { name: /pad volume/i })).toBeInTheDocument();

expect(remountedPad.volumeOverride).toBe(45);
```

- [ ] **Step 2: Run the pad tests to verify failure**

Run: `pnpm exec vitest run tests/components/soundboard/pad-editor.test.tsx tests/components/soundboard/soundboard-app.persistence.test.tsx`

Expected: FAIL because the editor does not expose volume controls yet.

- [ ] **Step 3: Implement the pad override UI and save flow**

Extend the editor submit payload:

```ts
type PadEditorSubmitValue = {
  // existing fields...
  volumeOverride: number | null;
};
```

Add the editor controls:

```tsx
<label>
  <input type="checkbox" checked={useDefaultVolume} />
  <span>Use default volume</span>
</label>
{!useDefaultVolume ? <input type="range" min="0" max="100" /> : null}
```

Then wire `handleEditorSave()` to persist `volumeOverride` and `handlePlay()` to resolve the effective volume before calling the player.

- [ ] **Step 4: Re-run the pad tests**

Run: `pnpm exec vitest run tests/components/soundboard/pad-editor.test.tsx tests/components/soundboard/soundboard-app.persistence.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the pad-volume slice**

```bash
git add components/soundboard/pad-editor.tsx components/soundboard/soundboard-app.tsx tests/components/soundboard/pad-editor.test.tsx tests/components/soundboard/soundboard-app.persistence.test.tsx
git commit -m "Add pad-level volume overrides"
```

### Task 5: Document the Feature and Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the public docs**

Document:

- the new settings dialog
- supported global settings
- pad-level volume overrides
- the fact that audio output selection is browser-dependent

Example README copy:

```md
- Dedicated settings dialog for playback behavior and default volume
- Optional per-pad volume overrides
- Progressive-enhancement audio output selection where supported
```

- [ ] **Step 2: Run the full verification suite**

Run:

```bash
pnpm test
pnpm test:coverage
pnpm lint
pnpm build
pnpm exec opennextjs-cloudflare build
git diff --check
```

Expected:

- all tests pass
- coverage remains healthy
- lint passes
- production build passes
- OpenNext build passes
- no whitespace or merge-marker issues remain

- [ ] **Step 3: Commit the docs and verification slice**

```bash
git add README.md docs/architecture.md
git commit -m "Document settings customization"
```

- [ ] **Step 4: Merge and smoke-test on `main`**

Run:

```bash
git switch main
git merge --ff-only <feature-branch>
pnpm test
pnpm lint
pnpm build
```

Expected: fast-forward merge and green verification on `main`

- [ ] **Step 5: Push `main` to trigger Cloudflare deployment**

Run:

```bash
git push origin main
```

Expected: `main` updates on GitHub and Cloudflare auto-deploy starts
