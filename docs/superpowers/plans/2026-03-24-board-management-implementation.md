# Board Management Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add board rename and delete support, plus inline naming during board creation, without leaving the existing sidebar-driven workflow.

**Architecture:** Extend the IndexedDB repository with board update and delete operations, then layer inline sidebar editing on top of the current board selection UI. Keep board lifecycle logic in `SoundboardApp`, and keep sidebar rendering focused on row state, actions, and inline inputs.

**Tech Stack:** Next.js 16.2.1, React, Tailwind CSS, TypeScript, Vitest, Testing Library, IndexedDB, OpenNext Cloudflare

---

## Planned File Structure

### Domain And Persistence

- Modify: `lib/soundboard/types.ts`
- Modify: `lib/soundboard/db.ts`
- Modify: `tests/lib/soundboard/db.test.ts`

### UI

- Modify: `components/soundboard/board-sidebar.tsx`
- Modify: `components/soundboard/soundboard-app.tsx`
- Modify: `tests/components/soundboard/soundboard-app.test.tsx`

## Naming Rules

- Board names are display-only values; IDs remain the source of identity
- Duplicate board names are allowed
- Input is trimmed before save
- Empty or whitespace-only values fall back to generated names such as `Board 3`
- Board names are limited to 20 characters in the UI and save flow

## Task 1: Extend Board Repository Operations

**Files:**
- Modify: `lib/soundboard/types.ts`
- Modify: `lib/soundboard/db.ts`
- Test: `tests/lib/soundboard/db.test.ts`

- [ ] **Step 1: Write failing DB tests for board rename and delete**

Cover:

- renaming a board updates `name` and `updatedAt`
- deleting a board removes its pads
- deleting the active board promotes another board or clears `activeBoardId`

- [ ] **Step 2: Run the DB test file and verify the new cases fail**

Run:

```bash
pnpm test tests/lib/soundboard/db.test.ts
```

Expected: FAIL because `updateBoard` and `deleteBoard` do not exist yet

- [ ] **Step 3: Add repository types for board update and board delete**

Update `lib/soundboard/types.ts` with explicit board mutation input types and extend `SoundboardRepository`.

- [ ] **Step 4: Implement `updateBoard` and `deleteBoard` in IndexedDB**

Implementation requirements:

- keep board ordering stable
- delete all pads whose `boardId` matches the deleted board
- update `settings.activeBoardId` inside the same board-delete transaction

- [ ] **Step 5: Re-run the DB test file and verify it passes**

Run:

```bash
pnpm test tests/lib/soundboard/db.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/soundboard/types.ts lib/soundboard/db.ts tests/lib/soundboard/db.test.ts
git commit -m "feat: add board rename and delete storage"
```

## Task 2: Add Sidebar Inline Edit And Delete UI

**Files:**
- Modify: `components/soundboard/board-sidebar.tsx`
- Test: `tests/components/soundboard/soundboard-app.test.tsx`

- [ ] **Step 1: Write failing UI tests for board creation naming and board actions**

Cover:

- newly created board enters inline rename mode
- existing board can enter rename mode
- deleting an empty board removes it immediately
- deleting a board with pads asks for confirmation

- [ ] **Step 2: Run the component test file and verify the new cases fail**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: FAIL because the sidebar does not yet expose rename or delete behavior

- [ ] **Step 3: Add inline edit and row action states to the sidebar component**

Implementation requirements:

- preserve row click to select the board
- keep actions secondary and compact
- render input plus confirm/cancel controls when a row is being edited
- enforce the 20-character limit in the text input

- [ ] **Step 4: Re-run the component test file and confirm the sidebar rendering cases now pass**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: the renamed and deleted board UI cases pass, even if app-level handlers still need follow-up fixes

- [ ] **Step 5: Commit**

```bash
git add components/soundboard/board-sidebar.tsx tests/components/soundboard/soundboard-app.test.tsx
git commit -m "feat: add inline board management controls"
```

## Task 3: Wire Board Lifecycle Behavior In SoundboardApp

**Files:**
- Modify: `components/soundboard/soundboard-app.tsx`
- Modify: `tests/components/soundboard/soundboard-app.test.tsx`

- [ ] **Step 1: Add failing app-level tests for rename fallback and active-board deletion behavior**

Cover:

- blank board rename normalizes to fallback `Board N`
- deleting the active board selects the next available board
- deleting the last remaining board returns to the empty workspace screen

- [ ] **Step 2: Run the component test file and verify the new app cases fail**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: FAIL because `SoundboardApp` does not yet manage board edit state or delete transitions

- [ ] **Step 3: Implement board draft state and sidebar handlers in `SoundboardApp`**

Implementation requirements:

- generate fallback board names based on board count
- enter rename mode immediately after board creation
- trim board names before save
- allow duplicate names without warning
- keep fallback names when the submitted name is blank
- treat whitespace-only names as blank after trim
- keep or clamp names to 20 characters before persistence
- check pad count before delete confirmation
- transition active board correctly after delete

- [ ] **Step 4: Re-run the component test file and verify all board-management UI tests pass**

Run:

```bash
pnpm test tests/components/soundboard/soundboard-app.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/soundboard/soundboard-app.tsx tests/components/soundboard/soundboard-app.test.tsx
git commit -m "feat: wire board rename and delete flows"
```

## Task 4: Final Verification

**Files:**
- No new files

- [ ] **Step 1: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: PASS with all test files green

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no ESLint errors

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm build
```

Expected: PASS with no Next.js build failures

- [ ] **Step 4: Run the Cloudflare OpenNext build**

Run:

```bash
pnpm exec opennextjs-cloudflare build
```

Expected: PASS and emit `.open-next/worker.js`

- [ ] **Step 5: Commit final polish if needed**

```bash
git add -A
git commit -m "test: verify board management changes"
```
