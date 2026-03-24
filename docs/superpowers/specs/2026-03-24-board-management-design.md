# Board Management Refinement Design

Date: 2026-03-24
Status: Approved for planning

## Overview

This change extends the existing multi-board soundboard so boards can be renamed and deleted, and so new boards can accept a user-provided name without forcing a modal or a separate settings screen.

The design keeps board management inside the existing left sidebar. This matches the current layout, keeps the interaction model local to the board list, and avoids introducing a second editing surface for board metadata.

## Goals

- Let users rename an existing board
- Let users delete any board, including the last remaining board
- Ask for confirmation before deleting a board that contains one or more pads
- Let users provide a board name at creation time
- Keep `Board 1`, `Board 2`, and so on as the fallback naming pattern when the user leaves the name empty

## Non-Goals

- Reordering boards
- Multi-select board actions
- Modal-based board settings
- Undo for rename or delete
- Cross-board move of pads during delete

## Chosen Approach

Board management will stay in the sidebar with inline editing.

- `Create Board` will create a board immediately and put that row into inline rename mode
- The initial text field value will default to the generated name, such as `Board 3`
- If the user leaves the edited name blank, the fallback generated name remains
- Existing boards will expose inline `rename` and `delete` actions in the same sidebar row
- Deleting a board with pads will require explicit confirmation

This approach was chosen over a modal or browser `prompt()` because it keeps creation, selection, rename, and delete in the same visual context and fits the existing management-first sidebar.

## Data And Persistence Changes

The persistent board model does not need a schema expansion. The existing `boards` store already contains the fields needed for rename and delete:

- `id`
- `name`
- `order`
- `createdAt`
- `updatedAt`

The repository interface needs two new operations:

- `updateBoard`
- `deleteBoard`

Deleting a board must also delete all pads owned by that board and update `settings.activeBoardId`.

## Board Lifecycle Rules

### Create

1. User clicks `Create Board`
2. The app creates a new board immediately using the next fallback name
3. The new board becomes active
4. The new row enters inline rename mode in the sidebar
5. If the user confirms an empty name, the fallback board name is kept

### Rename

1. User triggers rename on a board row
2. The board label turns into an inline text input
3. Confirming a non-empty value stores the trimmed name
4. Confirming an empty value restores the current fallback-or-existing name instead of saving an empty string
5. Cancelling exits edit mode without changing the board

### Delete

1. User triggers delete on a board row
2. If the board has one or more pads, the app asks for confirmation
3. If confirmed, the board and its pads are removed
4. If the deleted board was active:
   - switch to the next available board when one exists
   - otherwise clear the active board and show the empty workspace screen

## UI Structure

The sidebar board rows will gain compact management affordances.

- Normal row:
  - board name
  - active state indicator
  - rename action
  - delete action
- Inline edit row:
  - text input
  - confirm action
  - cancel action

The action density should stay restrained. Actions should remain secondary to board selection and should not overpower the row label.

## Confirmation Rules

### Delete Confirmation

Ask for confirmation only when the target board contains at least one pad.

Recommended copy:

- Title line: `Delete this board?`
- Body line: `This board contains saved sound pads. Deleting it will remove them from this browser.`

For an empty board, delete immediately without a confirmation step.

### Rename/Create Empty Name Handling

Do not show a warning dialog for an empty board name. Instead, normalize to the generated fallback name.

## Acceptance Criteria

- A user can create a board and immediately rename it inline in the sidebar
- Leaving a new board name blank keeps a generated fallback name such as `Board 3`
- A user can rename an existing board inline
- A user can delete a board from the sidebar
- Deleting a board with pads asks for confirmation
- Deleting an empty board does not ask for confirmation
- Deleting the active board switches to another board when possible
- Deleting the last remaining board returns the app to the empty workspace state
- Board rename and delete changes persist after reload
