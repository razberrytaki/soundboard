import type { SoundboardBoard } from "@/lib/soundboard/types";

type BoardSidebarProps = {
  boards: SoundboardBoard[];
  activeBoardId: string | null;
  onCreateBoard(): void;
  onSelectBoard(boardId: string): void;
};

export function BoardSidebar({
  boards,
  activeBoardId,
  onCreateBoard,
  onSelectBoard,
}: BoardSidebarProps) {
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

          return (
            <button
              aria-label={board.name}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5 ${
                active
                  ? "border-[rgba(217,91,67,0.35)] bg-[rgba(217,91,67,0.1)] text-[var(--color-ink)]"
                  : "border-transparent bg-transparent text-[var(--color-muted)] hover:border-[var(--color-line)] hover:bg-[rgba(255,255,255,0.6)]"
              }`}
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              type="button"
            >
              <span className="truncate text-base font-medium">{board.name}</span>
              <span className="ml-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em]">
                {active ? "Live" : "Idle"}
              </span>
            </button>
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
