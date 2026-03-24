"use client";

import { useEffect, useState } from "react";

import { BoardSidebar } from "@/components/soundboard/board-sidebar";
import { PadEditor } from "@/components/soundboard/pad-editor";
import { PadGrid } from "@/components/soundboard/pad-grid";
import { SettingsPanel } from "@/components/soundboard/settings-panel";
import { createAudioPlayer } from "@/lib/soundboard/audio-player";
import { createSoundboardDb } from "@/lib/soundboard/db";
import type {
  SoundboardBoard,
  SoundboardPad,
  SoundboardRepository,
  SoundboardSettings,
} from "@/lib/soundboard/types";

const DISCARD_CHANGES_MESSAGE =
  "Discard unsaved changes?\nYour current pad edits will be lost.";
const DELETE_BOARD_MESSAGE =
  "Delete this board?\nThis board contains saved sound pads. Deleting it will remove them from this browser.";
const BOARD_NAME_LIMIT = 20;

type SoundboardPlayer = {
  play(blob: Blob): Promise<void>;
  setAllowConcurrentPlayback(value: boolean): void;
  getActiveCount(): number;
  stopAll(): void;
};

type SoundboardAppProps = {
  repository?: SoundboardRepository;
  player?: SoundboardPlayer;
};

function clampBoardNameLength(value: string) {
  return Array.from(value).slice(0, BOARD_NAME_LIMIT).join("");
}

function getNextBoardName(records: SoundboardBoard[]) {
  return `Board ${records.length + 1}`;
}

export function SoundboardApp({ repository, player }: SoundboardAppProps) {
  const [repositoryInstance] = useState<SoundboardRepository>(
    () => repository ?? createSoundboardDb(),
  );
  const [playerInstance] = useState<SoundboardPlayer>(
    () => player ?? createAudioPlayer(),
  );
  const [boards, setBoards] = useState<SoundboardBoard[]>([]);
  const [pads, setPads] = useState<SoundboardPad[]>([]);
  const [settings, setSettings] = useState<SoundboardSettings | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardEditorState, setBoardEditorState] = useState<{
    boardId: string;
    draftName: string;
  } | null>(null);
  const [editorState, setEditorState] = useState<
    { mode: "create" } | { mode: "edit"; padId: string } | null
  >(null);
  const [createEditorVersion, setCreateEditorVersion] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [loadedBoards, loadedSettings] = await Promise.all([
        repositoryInstance.listBoards(),
        repositoryInstance.getSettings(),
      ]);

      if (cancelled) {
        return;
      }

      setBoards(loadedBoards);
      setSettings(loadedSettings);
      playerInstance.setAllowConcurrentPlayback(
        loadedSettings.allowConcurrentPlayback,
      );

      const nextActiveBoardId =
        loadedSettings.activeBoardId ?? loadedBoards[0]?.id ?? null;

      setActiveBoardId(nextActiveBoardId);

      if (!nextActiveBoardId) {
        setPads([]);
        setLoading(false);
        return;
      }

      const loadedPads = await repositoryInstance.listPads(nextActiveBoardId);

      if (cancelled) {
        return;
      }

      setPads(loadedPads);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [playerInstance, repositoryInstance]);

  const activeBoard =
    boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null;
  const activeBoardIsEditing =
    activeBoard !== null && boardEditorState?.boardId === activeBoard.id;
  const editedPad =
    editorState?.mode === "edit"
      ? pads.find((pad) => pad.id === editorState.padId) ?? null
      : null;
  const editedPadIndex = editedPad
    ? pads.findIndex((pad) => pad.id === editedPad.id)
    : -1;

  const resetPadEditor = () => {
    setCreateEditorVersion((current) => current + 1);
    setHasUnsavedChanges(false);
    setEditorState(null);
  };

  const normalizeBoardName = (value: string, fallbackName: string) => {
    const trimmedValue = clampBoardNameLength(value.trim());

    return trimmedValue.length > 0 ? trimmedValue : fallbackName;
  };

  const requestEditorStateChange = (
    nextState: { mode: "create" } | { mode: "edit"; padId: string },
  ) => {
    if (
      editorState?.mode === "edit" &&
      nextState.mode === "edit" &&
      editorState.padId === nextState.padId
    ) {
      return;
    }

    if (hasUnsavedChanges && !window.confirm(DISCARD_CHANGES_MESSAGE)) {
      return;
    }

    if (nextState.mode === "create") {
      setCreateEditorVersion((current) => current + 1);
    }

    setHasUnsavedChanges(false);
    setEditorState(nextState);
  };

  const handleBoardSelect = async (boardId: string) => {
    setActiveBoardId(boardId);
    setBoardEditorState(null);
    resetPadEditor();
    const nextSettings = await repositoryInstance.updateSettings({
      activeBoardId: boardId,
    });
    const nextPads = await repositoryInstance.listPads(boardId);

    setSettings(nextSettings);
    setPads(nextPads);
  };

  const handleCreateBoard = async () => {
    const fallbackName = getNextBoardName(boards);
    const nextBoard = await repositoryInstance.createBoard({
      name: fallbackName,
    });
    const [nextSettings, nextBoards] = await Promise.all([
      repositoryInstance.updateSettings({
        activeBoardId: nextBoard.id,
      }),
      repositoryInstance.listBoards(),
    ]);

    setBoards(nextBoards);
    setSettings(nextSettings);
    setActiveBoardId(nextBoard.id);
    setPads([]);
    resetPadEditor();
    setBoardEditorState({
      boardId: nextBoard.id,
      draftName: fallbackName,
    });
  };

  const refreshPads = async (boardId: string) => {
    const nextPads = await repositoryInstance.listPads(boardId);

    setPads(nextPads);
    return nextPads;
  };

  const handleEditorSave = async (value: {
    id?: string;
    label: string;
    color: string;
    audioBlob: Blob;
    audioName: string;
    mimeType: string;
  }) => {
    if (!activeBoardId) {
      return;
    }

    const nextOrder =
      editorState?.mode === "edit" && editedPad
        ? editedPad.order
        : Math.max(0, ...pads.map((pad) => pad.order)) + 1;

    await repositoryInstance.savePad({
      id: value.id,
      boardId: activeBoardId,
      label: value.label.trim(),
      color: value.color,
      order: nextOrder,
      audioBlob: value.audioBlob,
      audioName: value.audioName,
      mimeType: value.mimeType,
    });

    await refreshPads(activeBoardId);
    setCreateEditorVersion((current) => current + 1);
    setHasUnsavedChanges(false);
    setEditorState(null);
  };

  const handleDeletePad = async () => {
    if (!activeBoardId || !editedPad) {
      return;
    }

    await repositoryInstance.deletePad(editedPad.id);
    await refreshPads(activeBoardId);
    resetPadEditor();
  };

  const movePad = async (direction: -1 | 1) => {
    if (!activeBoardId || !editedPad) {
      return;
    }

    const targetPad = pads[editedPadIndex + direction];

    if (!targetPad) {
      return;
    }

    await repositoryInstance.savePad({
      id: editedPad.id,
      boardId: editedPad.boardId,
      label: editedPad.label,
      color: editedPad.color,
      order: targetPad.order,
      audioBlob: editedPad.audioBlob,
      audioName: editedPad.audioName,
      mimeType: editedPad.mimeType,
    });
    await repositoryInstance.savePad({
      id: targetPad.id,
      boardId: targetPad.boardId,
      label: targetPad.label,
      color: targetPad.color,
      order: editedPad.order,
      audioBlob: targetPad.audioBlob,
      audioName: targetPad.audioName,
      mimeType: targetPad.mimeType,
    });

    await refreshPads(activeBoardId);
  };

  const handleBoardRenameStart = (boardId: string) => {
    const board = boards.find((entry) => entry.id === boardId);

    if (!board) {
      return;
    }

    setBoardEditorState({
      boardId,
      draftName: board.name,
    });
  };

  const handleBoardEditingNameChange = (value: string) => {
    setBoardEditorState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        draftName: clampBoardNameLength(value),
      };
    });
  };

  const handleBoardRenameCancel = () => {
    setBoardEditorState(null);
  };

  const handleBoardRenameSave = async (boardId: string) => {
    const board = boards.find((entry) => entry.id === boardId);

    if (!board || boardEditorState?.boardId !== boardId) {
      return;
    }

    const nextName = normalizeBoardName(boardEditorState.draftName, board.name);

    if (nextName === board.name) {
      setBoardEditorState(null);
      return;
    }

    await repositoryInstance.updateBoard({
      id: boardId,
      name: nextName,
    });

    const nextBoards = await repositoryInstance.listBoards();

    setBoards(nextBoards);
    setBoardEditorState(null);
  };

  const handleBoardDelete = async (boardId: string) => {
    const boardPads = await repositoryInstance.listPads(boardId);

    if (
      boardPads.length > 0 &&
      !window.confirm(DELETE_BOARD_MESSAGE)
    ) {
      return;
    }

    await repositoryInstance.deleteBoard(boardId);

    const [nextBoards, nextSettings] = await Promise.all([
      repositoryInstance.listBoards(),
      repositoryInstance.getSettings(),
    ]);
    const nextActiveBoardId =
      nextSettings.activeBoardId ?? nextBoards[0]?.id ?? null;
    const activeBoardChanged = nextActiveBoardId !== activeBoardId;
    const nextPads =
      activeBoardChanged && nextActiveBoardId
        ? await repositoryInstance.listPads(nextActiveBoardId)
        : [];

    setBoards(nextBoards);
    setSettings(nextSettings);
    setActiveBoardId(nextActiveBoardId);
    setBoardEditorState((current) =>
      current?.boardId === boardId ? null : current,
    );

    if (activeBoardChanged) {
      setPads(nextPads);
      resetPadEditor();
      return;
    }

    if (nextBoards.length === 0) {
      setPads([]);
      resetPadEditor();
    }
  };

  const handleConcurrentPlaybackToggle = async (value: boolean) => {
    const nextSettings = await repositoryInstance.updateSettings({
      allowConcurrentPlayback: value,
    });

    setSettings(nextSettings);
    playerInstance.setAllowConcurrentPlayback(value);
  };

  const handlePlay = async (pad: SoundboardPad) => {
    await playerInstance.play(pad.audioBlob);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,91,67,0.12),_transparent_28%),linear-gradient(180deg,_#f6f1e7_0%,_#efe5d4_100%)] px-4 py-4 text-[var(--color-ink)] md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center rounded-[28px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.86)] text-sm text-[var(--color-muted)] shadow-[var(--shadow-shell)] backdrop-blur">
          Loading soundboard...
        </div>
      </main>
    );
  }

  if (boards.length === 0) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,91,67,0.12),_transparent_28%),linear-gradient(180deg,_#f6f1e7_0%,_#efe5d4_100%)] px-4 py-4 text-[var(--color-ink)] md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center rounded-[28px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.86)] shadow-[var(--shadow-shell)] backdrop-blur">
          <div className="max-w-md px-6 py-10 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
              Empty Workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              Create your first board
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Your saved boards and sounds will appear here after the first setup.
            </p>
            <button
              className="mt-6 rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => void handleCreateBoard()}
              type="button"
            >
              Create Board
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(217,91,67,0.12),_transparent_28%),linear-gradient(180deg,_#f6f1e7_0%,_#efe5d4_100%)] px-4 py-4 text-[var(--color-ink)] md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 overflow-hidden rounded-[28px] border border-[var(--color-line)] bg-[rgba(251,248,242,0.86)] shadow-[var(--shadow-shell)] backdrop-blur md:min-h-[calc(100vh-3rem)] md:grid-cols-[280px_minmax(0,1fr)] md:gap-0">
        <BoardSidebar
          activeBoardId={activeBoard?.id ?? null}
          boards={boards}
          onCreateBoard={() => void handleCreateBoard()}
          onSelectBoard={(boardId) => void handleBoardSelect(boardId)}
        />

        <section className="flex min-w-0 flex-col">
          <header className="flex flex-col gap-4 border-b border-[var(--color-line)] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Active Board
              </p>
              {activeBoardIsEditing ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="sr-only">Board name</span>
                    <input
                      aria-label="Board name"
                      autoFocus
                      className="w-full max-w-xl rounded-2xl border border-[var(--color-line)] bg-white/90 px-4 py-3 text-2xl font-semibold tracking-[-0.05em] outline-none transition-colors focus:border-[var(--color-accent)] md:text-4xl"
                      maxLength={BOARD_NAME_LIMIT}
                      onChange={(event) =>
                        handleBoardEditingNameChange(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (!activeBoard) {
                          return;
                        }

                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleBoardRenameSave(activeBoard.id);
                        }

                        if (event.key === "Escape") {
                          event.preventDefault();
                          handleBoardRenameCancel();
                        }
                      }}
                      value={boardEditorState?.draftName ?? ""}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5"
                      onClick={() =>
                        activeBoard && void handleBoardRenameSave(activeBoard.id)
                      }
                      type="button"
                    >
                      Save board name
                    </button>
                    <button
                      className="rounded-full border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-muted)] transition-colors duration-200 hover:bg-white/70 hover:text-[var(--color-ink)]"
                      onClick={handleBoardRenameCancel}
                      type="button"
                    >
                      Cancel rename
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h1 className="text-4xl font-semibold tracking-[-0.05em]">
                      {activeBoard?.name}
                    </h1>
                    <p className="max-w-xl text-sm leading-6 text-[var(--color-muted)] md:text-base">
                      Stored locally in this browser and restored on the next
                      visit.
                    </p>
                  </div>
                  {activeBoard ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        aria-label={`Rename ${activeBoard.name}`}
                        className="rounded-full border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/70"
                        onClick={() => handleBoardRenameStart(activeBoard.id)}
                        type="button"
                      >
                        Rename
                      </button>
                      <button
                        aria-label={`Delete ${activeBoard.name}`}
                        className="rounded-full border border-[rgba(217,91,67,0.22)] bg-[rgba(217,91,67,0.08)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-[rgba(217,91,67,0.15)]"
                        onClick={() => void handleBoardDelete(activeBoard.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SettingsPanel
                allowConcurrentPlayback={settings?.allowConcurrentPlayback ?? true}
                onToggle={(value) => void handleConcurrentPlaybackToggle(value)}
              />
              <button
                className="rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5"
                onClick={() => requestEditorStateChange({ mode: "create" })}
                type="button"
              >
                New Pad
              </button>
            </div>
          </header>

          <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_320px] md:px-8 md:py-7">
            <PadGrid
              onEdit={(pad) =>
                requestEditorStateChange({ mode: "edit", padId: pad.id })
              }
              onPlay={(pad) => void handlePlay(pad)}
              pads={pads}
            />
            <PadEditor
              key={
                editorState?.mode === "edit"
                  ? editorState.padId
                  : `${activeBoardId ?? "none"}-${createEditorVersion}`
              }
              canMoveDown={editedPadIndex >= 0 && editedPadIndex < pads.length - 1}
              canMoveUp={editedPadIndex > 0}
              mode={editorState?.mode ?? "create"}
              onDirtyChange={setHasUnsavedChanges}
              onDelete={() => void handleDeletePad()}
              onMoveDown={() => void movePad(1)}
              onMoveUp={() => void movePad(-1)}
              onSave={handleEditorSave}
              pad={editedPad}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
