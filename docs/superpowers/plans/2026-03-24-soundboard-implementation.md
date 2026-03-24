# Soundboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working version of the browser-based soundboard in Next.js with local persistence, multi-board management, basic pad editing, and sound playback.

**Architecture:** The app will use Next.js App Router for the shell, React client components for interaction, IndexedDB for persistent local data, and browser-native audio playback with `HTMLAudioElement`. The UI will use a two-column management-first layout with a board sidebar and a main pad grid, while keeping storage and playback logic isolated in focused local modules.

**Tech Stack:** Next.js 16.2.1, React, Tailwind CSS, pnpm, IndexedDB, browser audio APIs

---

## Pre-Flight Decisions

These items should be confirmed before executing the plan because they affect scaffolding and test setup.

- Language: recommend TypeScript for storage and UI correctness in a client-heavy app
- Test tooling: recommend `vitest` + `@testing-library/react` + `jsdom` as the smallest practical UI test stack
- Isolated workspace location: recommend project-local `.worktrees/` so feature work stays off `main`

## Planned File Structure

### Project and Tooling

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json` if TypeScript is approved
- Create: `next-env.d.ts` if TypeScript is approved
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `.worktrees/<branch>/` if project-local worktrees are approved

### App Shell

- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

### Core Domain

- Create: `lib/soundboard/types.ts`
- Create: `lib/soundboard/db.ts`
- Create: `lib/soundboard/audio-player.ts`
- Create: `lib/soundboard/defaults.ts`

### UI Components

- Create: `components/soundboard/soundboard-app.tsx`
- Create: `components/soundboard/board-sidebar.tsx`
- Create: `components/soundboard/pad-grid.tsx`
- Create: `components/soundboard/pad-card.tsx`
- Create: `components/soundboard/pad-editor.tsx`
- Create: `components/soundboard/settings-panel.tsx`

### Tests

- Create: `vitest.config.ts` if Vitest is approved
- Create: `vitest.setup.ts` if Vitest is approved
- Create: `tests/lib/soundboard/db.test.ts`
- Create: `tests/lib/soundboard/audio-player.test.ts`
- Create: `tests/components/soundboard/soundboard-app.test.tsx`

## Task 1: Set Up Isolated Workspace And Baseline Tooling

**Files:**
- Modify: `.gitignore`
- Create: `.worktrees/<branch>/` or use global worktree directory if chosen
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Create an isolated feature branch before implementation**

Run one of:

```bash
git check-ignore -q .worktrees || printf '\n.worktrees/\n' >> .gitignore
git add .gitignore
git commit -m "chore: ignore worktrees"
git worktree add .worktrees/codex/soundboard-v1 -b codex/soundboard-v1
```

Or, if the global worktree directory is chosen:

```bash
git worktree add ~/.config/superpowers/worktrees/soundboard/codex/soundboard-v1 -b codex/soundboard-v1
```

- [ ] **Step 2: Install the baseline app dependencies**

Run:

```bash
pnpm add next@16.2.1 react react-dom
pnpm add -D tailwindcss @tailwindcss/postcss eslint eslint-config-next typescript @types/node @types/react @types/react-dom
```

If tests are approved, also run:

```bash
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Write the minimum app and tooling files**

Create the basic Next.js app shell and CSS pipeline with:

- `package.json` scripts: `dev`, `build`, `start`, `lint`, `test`
- `app/layout.tsx` root layout
- `app/page.tsx` temporary placeholder rendering a soundboard shell
- `app/globals.css` with Tailwind import and design tokens
- `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json`, `next-env.d.ts`

- [ ] **Step 4: Verify the baseline app starts and builds**

Run:

```bash
pnpm build
```

Expected: successful production build with no missing-config errors

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next-env.d.ts next.config.ts postcss.config.mjs eslint.config.mjs app
git commit -m "chore: scaffold Next.js soundboard app"
```

## Task 2: Build The Soundboard Domain Model And IndexedDB Layer

**Files:**
- Create: `lib/soundboard/types.ts`
- Create: `lib/soundboard/defaults.ts`
- Create: `lib/soundboard/db.ts`
- Test: `tests/lib/soundboard/db.test.ts`

- [ ] **Step 1: Write the failing IndexedDB tests**

Cover:

- creating the first board
- listing boards in stored order
- saving pads for a board
- restoring `activeBoardId`
- updating `allowConcurrentPlayback`
- deleting a pad

Example test cases:

```ts
it('creates and restores the first board as active', async () => {
  const db = createSoundboardDb('test-db');
  const board = await db.createBoard({ name: 'Stream' });

  const settings = await db.getSettings();

  expect(board.name).toBe('Stream');
  expect(settings.activeBoardId).toBe(board.id);
});
```

```ts
it('stores pads with audio blobs and returns them ordered by order', async () => {
  const db = createSoundboardDb('test-db');
  const board = await db.createBoard({ name: 'Memes' });

  await db.savePad({
    boardId: board.id,
    label: 'Airhorn',
    color: '#ff6b4a',
    order: 2,
    audioBlob: new Blob(['a'], { type: 'audio/mpeg' }),
    audioName: 'airhorn.mp3',
    mimeType: 'audio/mpeg',
  });

  await db.savePad({
    boardId: board.id,
    label: 'Clap',
    color: '#2f8f83',
    order: 1,
    audioBlob: new Blob(['b'], { type: 'audio/mpeg' }),
    audioName: 'clap.mp3',
    mimeType: 'audio/mpeg',
  });

  const pads = await db.listPads(board.id);

  expect(pads.map((pad) => pad.label)).toEqual(['Clap', 'Airhorn']);
});
```

- [ ] **Step 2: Run the DB tests to verify they fail for the right reason**

Run:

```bash
pnpm test tests/lib/soundboard/db.test.ts
```

Expected: FAIL because `createSoundboardDb` and related storage helpers do not exist yet

- [ ] **Step 3: Implement the storage types, defaults, and IndexedDB adapter**

Implement:

- typed domain records for boards, pads, and settings
- schema/version setup in one place
- CRUD helpers for boards, pads, settings
- stable sort by `order`
- initial default settings and first-board bootstrapping behavior

- [ ] **Step 4: Run the DB tests again**

Run:

```bash
pnpm test tests/lib/soundboard/db.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/soundboard tests/lib/soundboard/db.test.ts
git commit -m "feat: add IndexedDB soundboard storage"
```

## Task 3: Build The Audio Playback Manager

**Files:**
- Create: `lib/soundboard/audio-player.ts`
- Test: `tests/lib/soundboard/audio-player.test.ts`

- [ ] **Step 1: Write the failing playback tests**

Cover:

- playing a sound creates an audio instance from a blob
- concurrent mode leaves existing playback alone
- single-play mode stops previous instances before starting a new one
- finished instances are cleaned up

Example test case:

```ts
it('stops previous audio when concurrent playback is disabled', async () => {
  const player = createAudioPlayer({ allowConcurrentPlayback: false });
  const first = new Blob(['a'], { type: 'audio/mpeg' });
  const second = new Blob(['b'], { type: 'audio/mpeg' });

  await player.play(first);
  await player.play(second);

  expect(player.getActiveCount()).toBe(1);
});
```

- [ ] **Step 2: Run the playback tests to verify they fail**

Run:

```bash
pnpm test tests/lib/soundboard/audio-player.test.ts
```

Expected: FAIL because the playback manager does not exist yet

- [ ] **Step 3: Implement the minimal playback manager**

Implement:

- an in-memory registry of active `HTMLAudioElement` instances
- object URL creation and cleanup
- `play`, `stopAll`, and `setAllowConcurrentPlayback` behavior
- event cleanup when audio ends or errors

- [ ] **Step 4: Run the playback tests again**

Run:

```bash
pnpm test tests/lib/soundboard/audio-player.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/soundboard/audio-player.ts tests/lib/soundboard/audio-player.test.ts
git commit -m "feat: add sound playback manager"
```

## Task 4: Build The Restorable App Shell

**Files:**
- Create: `components/soundboard/soundboard-app.tsx`
- Create: `components/soundboard/board-sidebar.tsx`
- Create: `components/soundboard/pad-grid.tsx`
- Create: `components/soundboard/pad-card.tsx`
- Modify: `app/page.tsx`
- Test: `tests/components/soundboard/soundboard-app.test.tsx`

- [ ] **Step 1: Write the failing app shell tests**

Cover:

- loading boards and the active board on initial render
- rendering the selected board title and pad grid
- switching boards from the sidebar
- empty state when no boards or no pads exist

Example test case:

```tsx
it('restores the active board and renders its pads', async () => {
  render(<SoundboardApp repository={repository} player={player} />);

  expect(await screen.findByText('Stream')).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Airhorn' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the app shell tests to verify they fail**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: FAIL because the app shell and injected dependencies do not exist yet

- [ ] **Step 3: Implement the minimal restorable shell**

Implement:

- a client component that loads repository data on mount
- sidebar board list with create/select actions
- current board heading
- grid that renders pads or an empty state
- dependency injection for repository and playback manager to keep tests isolated

- [ ] **Step 4: Run the app shell tests again**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/soundboard tests/components/soundboard/soundboard-app.test.tsx
git commit -m "feat: add restorable soundboard shell"
```

## Task 5: Add Pad Editing, Reordering, And Settings

**Files:**
- Create: `components/soundboard/pad-editor.tsx`
- Create: `components/soundboard/settings-panel.tsx`
- Modify: `components/soundboard/soundboard-app.tsx`
- Modify: `components/soundboard/pad-grid.tsx`
- Modify: `components/soundboard/pad-card.tsx`
- Test: `tests/components/soundboard/soundboard-app.test.tsx`

- [ ] **Step 1: Extend the failing component tests**

Cover:

- adding a pad with a label, color, and uploaded file
- editing an existing pad
- deleting a pad
- moving a pad up or down in order without drag-and-drop dependencies
- toggling the concurrent playback setting

Example test case:

```tsx
it('adds a new pad and persists it through the repository', async () => {
  render(<SoundboardApp repository={repository} player={player} />);

  await user.click(screen.getByRole('button', { name: /add sound/i }));
  await user.type(screen.getByLabelText(/name/i), 'Laugh');
  await user.upload(screen.getByLabelText(/audio file/i), new File(['a'], 'laugh.mp3', { type: 'audio/mpeg' }));
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByRole('button', { name: 'Laugh' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: FAIL because edit flows and settings controls do not exist yet

- [ ] **Step 3: Implement the minimal editor and settings UI**

Implement:

- add/edit surface as a modal or side panel in the current page context
- file upload field, label field, color selection, save/cancel
- delete action for pads
- move up/down ordering controls
- global settings panel with `allowConcurrentPlayback`

- [ ] **Step 4: Run the component tests again**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/soundboard tests/components/soundboard/soundboard-app.test.tsx
git commit -m "feat: add pad editing and playback settings"
```

## Task 6: Wire Playback, Styling, And Final Verification

**Files:**
- Modify: `components/soundboard/soundboard-app.tsx`
- Modify: `components/soundboard/pad-card.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

- [ ] **Step 1: Extend tests to cover click-to-play behavior**

Add coverage for:

- clicking a pad calls the playback manager with that pad's blob
- single-play mode replaces previous playback
- settings changes affect later playback

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
pnpm test tests/lib/soundboard/audio-player.test.ts tests/components/soundboard/soundboard-app.test.tsx
```

Expected: FAIL because UI click handling is not fully wired yet

- [ ] **Step 3: Implement playback wiring and finish visual polish**

Implement:

- pad click handler connected to the playback manager
- active interaction states for pads
- desktop two-column layout and mobile drawer fallback styling
- empty-state and form feedback polish

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected:

- tests PASS
- lint PASS
- build PASS

- [ ] **Step 5: Commit**

```bash
git add app components lib tests
git commit -m "feat: ship soundboard v1"
```

## Local Review Checklist

- The plan still honors the V1 scope from the approved spec
- Reordering is implemented without extra drag-and-drop dependencies
- Persistence is same-browser same-device only
- No backend work is introduced
- Test tooling is the minimum needed to support TDD for UI behavior
- Execution does not begin on `main`
