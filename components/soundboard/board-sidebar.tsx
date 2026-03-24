import type { KeyboardEvent } from "react";

import type { SoundboardBoard } from "@/lib/soundboard/types";

const BOARD_NAME_LIMIT = 20;

type BoardSidebarProps = {
  boards: SoundboardBoard[];
  activeBoardId: string | null;
  editingBoardId: string | null;
  editingName: string;
  onCreateBoard(): void;
  onSelectBoard(boardId: string): void;
  onStartRename(boardId: string): void;
  onEditingNameChange(value: string): void;
  onSubmitRename(boardId: string): void;
  onCancelRename(): void;
  onDeleteBoard(boardId: string): void;
};

export function BoardSidebar({
  boards,
  activeBoardId,
  editingBoardId,
  editingName,
  onCreateBoard,
  onSelectBoard,
  onStartRename,
  onEditingNameChange,
  onSubmitRename,
  onCancelRename,
  onDeleteBoard,
}: BoardSidebarProps) {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    boardId: string,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSubmitRename(boardId);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  return (
    <aside className="flex flex-col gap-5 border-b border-[var(--color-line)] bg-[rgba(245,238,226,0.95)] p-5 md:border-b-0 md:border-r md:p-6">
      <div className="space-y-2">
        <p className="font-[family-name:var(--font-mono)] text-[0.7rem] uppercase tracking-[0.3em] text-[var(--color-muted)]">
          Soundboard
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">Boards</h2>
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          Switch your live board instantly from the left rail.
        </p>
      </div>

      <div className="space-y-2">
        {boards.map((board) => {
          const active = board.id === activeBoardId;
          const editing = board.id === editingBoardId;

          if (editing) {
            return (
              <div
                className="space-y-3 rounded-2xl border border-[rgba(217,91,67,0.35)] bg-[rgba(255,255,255,0.78)] px-4 py-3"
                key={board.id}
              >
                <label className="block space-y-2">
                  <span className="sr-only">Board name</span>
                  <input
                    aria-label="Board name"
                    autoFocus
                    className="w-full rounded-2xl border border-[var(--color-line)] bg-white/90 px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                    maxLength={BOARD_NAME_LIMIT}
                    onChange={(event) => onEditingNameChange(event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, board.id)}
                    value={editingName}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    className="rounded-full bg-[var(--color-ink)] px-3 py-2 text-xs font-medium text-[var(--color-paper)]"
                    onClick={() => onSubmitRename(board.id)}
                    type="button"
                  >
                    Save board name
                  </button>
                  <button
                    className="rounded-full border border-[var(--color-line)] px-3 py-2 text-xs font-medium text-[var(--color-muted)]"
                    onClick={onCancelRename}
                    type="button"
                  >
                    Cancel rename
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              className={`flex items-center gap-2 rounded-2xl border px-3 py-3 transition-transform duration-200 hover:-translate-y-0.5 ${
                active
                  ? "border-[rgba(217,91,67,0.35)] bg-[rgba(217,91,67,0.1)] text-[var(--color-ink)]"
                  : "border-transparent bg-transparent text-[var(--color-muted)] hover:border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.6)]"
              }`}
              key={board.id}
            >
              <button
                aria-label={board.name}
                className="flex min-w-0 flex-1 items-center justify-between text-left"
                onClick={() => onSelectBoard(board.id)}
                type="button"
              >
                <span className="truncate text-base font-medium">{board.name}</span>
                <span className="ml-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em]">
                  {active ? "Live" : "Idle"}
                </span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  aria-label={`Rename ${board.name}`}
                  className="rounded-full border border-transparent px-2 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-[var(--color-muted)] transition-colors hover:border-[var(--color-line)] hover:bg-white/70 hover:text-[var(--color-ink)]"
                  onClick={() => onStartRename(board.id)}
                  type="button"
                >
                  Rename
                </button>
                <button
                  aria-label={`Delete ${board.name}`}
                  className="rounded-full border border-transparent px-2 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-[var(--color-muted)] transition-colors hover:border-[rgba(217,91,67,0.2)] hover:bg-[rgba(217,91,67,0.1)] hover:text-[var(--color-accent)]"
                  onClick={() => onDeleteBoard(board.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5"
        onClick={onCreateBoard}
        type="button"
      >
        Create Board
      </button>
    </aside>
  );
}
