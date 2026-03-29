"use client";

import { useEffect, useRef, useState } from "react";

import { BoardSidebar } from "@/components/soundboard/board-sidebar";
import { PadEditor } from "@/components/soundboard/pad-editor";
import { PadGrid } from "@/components/soundboard/pad-grid";
import { SettingsDialog } from "@/components/soundboard/settings-dialog";
import { createAudioPlayer } from "@/lib/soundboard/audio-player";
import {
  getAudioOutputCapabilities,
  listAudioOutputDevices,
  requestAudioInputPermission,
  selectAudioOutput,
  type AudioOutputDevice,
} from "@/lib/soundboard/audio-output";
import { createSoundboardDb } from "@/lib/soundboard/db";
import type {
  SoundboardBoard,
  SoundboardPad,
  SoundboardPadSummary,
  SoundboardRepository,
  SoundboardSettings,
} from "@/lib/soundboard/types";
import {
  BOARD_NAME_MAX_LENGTH,
  limitBoardNameInput,
  normalizeBoardName,
  normalizePadName,
} from "@/lib/soundboard/validation";

const DISCARD_CHANGES_MESSAGE =
  "Discard unsaved changes?\nYour current pad edits will be lost.";
const DELETE_BOARD_MESSAGE =
  "Delete this board?\nThis board contains saved sound pads. Deleting it will remove them from this browser.";
const DEFAULT_PAD_VOLUME_SAVE_DELAY_MS = 250;

type SoundboardPlayer = {
  play(blob: Blob, options?: { volume: number; outputDeviceId?: string | null }): Promise<void>;
  setAllowConcurrentPlayback(value: boolean): void;
  getActiveCount(): number;
  stopAll(): void;
};

type SoundboardAppProps = {
  repository?: SoundboardRepository;
  player?: SoundboardPlayer;
};

function getNextBoardName(records: SoundboardBoard[]) {
  return `Board ${records.length + 1}`;
}

function toPadSummary(pad: SoundboardPad): SoundboardPadSummary {
  const { audioBlob, ...summary } = pad;

  void audioBlob;

  return summary;
}

export function SoundboardApp({ repository, player }: SoundboardAppProps) {
  const [repositoryInstance] = useState<SoundboardRepository>(
    () => repository ?? createSoundboardDb(),
  );
  const [playerInstance] = useState<SoundboardPlayer>(
    () => player ?? createAudioPlayer(),
  );
  const [boards, setBoards] = useState<SoundboardBoard[]>([]);
  const [pads, setPads] = useState<SoundboardPadSummary[]>([]);
  const [settings, setSettings] = useState<SoundboardSettings | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [boardEditorState, setBoardEditorState] = useState<{
    boardId: string;
    draftName: string;
  } | null>(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isManagingPads, setIsManagingPads] = useState(false);
  const [editorState, setEditorState] = useState<
    { mode: "create" } | { mode: "edit"; padId: string } | null
  >(null);
  const [createEditorVersion, setCreateEditorVersion] = useState(0);
  const [editedPad, setEditedPad] = useState<SoundboardPad | null>(null);
  const [isLoadingEditedPad, setIsLoadingEditedPad] = useState(false);
  const [defaultPadVolumeDraft, setDefaultPadVolumeDraft] = useState<number | null>(
    null,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioOutputCapabilities] = useState(() => getAudioOutputCapabilities());
  const [audioOutputDevices, setAudioOutputDevices] = useState<AudioOutputDevice[]>(
    [],
  );
  const [isLoadingAudioOutputDevices, setIsLoadingAudioOutputDevices] =
    useState(false);
  const [isChoosingAudioOutput, setIsChoosingAudioOutput] = useState(false);
  const [isRequestingAudioPermission, setIsRequestingAudioPermission] =
    useState(false);
  const [audioOutputError, setAudioOutputError] = useState<string | null>(null);
  const padCacheRef = useRef<Map<string, SoundboardPad>>(new Map());

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

      const loadedPads = await repositoryInstance.listPadSummaries(nextActiveBoardId);

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

  useEffect(() => {
    if (
      !isSettingsDialogOpen ||
      !audioOutputCapabilities.canRouteOutput ||
      !audioOutputCapabilities.canEnumerateOutputs
    ) {
      return;
    }

    let cancelled = false;

    const loadAudioOutputs = async () => {
      setIsLoadingAudioOutputDevices(true);

      try {
        const devices = await listAudioOutputDevices();

        if (cancelled) {
          return;
        }

        setAudioOutputDevices(devices);
      } catch {
        if (cancelled) {
          return;
        }

        setAudioOutputError(
          "Couldn't list the available audio output devices. The app can still use the system default output device.",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingAudioOutputDevices(false);
        }
      }
    };

    void loadAudioOutputs();

    return () => {
      cancelled = true;
    };
  }, [
    audioOutputCapabilities.canEnumerateOutputs,
    audioOutputCapabilities.canRouteOutput,
    isSettingsDialogOpen,
  ]);

  useEffect(() => {
    if (editorState?.mode !== "edit") {
      setEditedPad(null);
      setIsLoadingEditedPad(false);
      return;
    }

    let cancelled = false;

    const loadEditedPad = async () => {
      setIsLoadingEditedPad(true);

      const cachedPad = padCacheRef.current.get(editorState.padId);

      if (cachedPad) {
        if (!cancelled) {
          setEditedPad(cachedPad);
          setIsLoadingEditedPad(false);
        }

        return;
      }

      const loadedPad = await repositoryInstance.getPad(editorState.padId);

      if (cancelled) {
        return;
      }

      if (loadedPad) {
        padCacheRef.current.set(loadedPad.id, loadedPad);
      }

      setEditedPad(loadedPad);
      setIsLoadingEditedPad(false);
    };

    void loadEditedPad();

    return () => {
      cancelled = true;
    };
  }, [editorState, repositoryInstance]);

  useEffect(() => {
    setDefaultPadVolumeDraft(settings?.defaultPadVolume ?? null);
  }, [settings?.defaultPadVolume]);

  useEffect(() => {
    if (
      settings === null ||
      defaultPadVolumeDraft === null ||
      defaultPadVolumeDraft === settings.defaultPadVolume
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void updateSettings({
        defaultPadVolume: defaultPadVolumeDraft,
      });
    }, DEFAULT_PAD_VOLUME_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [defaultPadVolumeDraft, settings]);

  const activeBoard =
    boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null;
  const activeBoardIsEditing =
    activeBoard !== null && boardEditorState?.boardId === activeBoard.id;
  const editedPadId =
    editorState?.mode === "edit" ? editorState.padId : null;
  const selectedManagePadId =
    isManagingPads && editorState?.mode === "edit" ? editorState.padId : null;
  const editedPadIndex = editedPadId
    ? pads.findIndex((pad) => pad.id === editedPadId)
    : -1;
  const effectiveDefaultPadVolume =
    defaultPadVolumeDraft ?? settings?.defaultPadVolume ?? 100;

  const resetPadEditor = () => {
    setCreateEditorVersion((current) => current + 1);
    setEditedPad(null);
    setIsLoadingEditedPad(false);
    setHasUnsavedChanges(false);
    setEditorState(null);
  };

  const getPad = async (padId: string) => {
    const cachedPad = padCacheRef.current.get(padId);

    if (cachedPad) {
      return cachedPad;
    }

    const loadedPad = await repositoryInstance.getPad(padId);

    if (loadedPad) {
      padCacheRef.current.set(loadedPad.id, loadedPad);
    }

    return loadedPad;
  };

  const canDiscardPadChanges = () =>
    !hasUnsavedChanges || window.confirm(DISCARD_CHANGES_MESSAGE);

  const updateSettings = async (patch: Partial<SoundboardSettings>) => {
    const nextSettings = await repositoryInstance.updateSettings(patch);

    setSettings(nextSettings);

    return nextSettings;
  };

  const openCreatePadEditor = () => {
    if (isManagingPads) {
      return;
    }

    if (!canDiscardPadChanges()) {
      return;
    }

    setIsManagingPads(false);
    setCreateEditorVersion((current) => current + 1);
    setHasUnsavedChanges(false);
    setEditorState({ mode: "create" });
  };

  const toggleManagePads = () => {
    if (!canDiscardPadChanges()) {
      return;
    }

    setIsManagingPads((current) => !current);
    resetPadEditor();
  };

  const selectPadForManagement = (pad: SoundboardPadSummary) => {
    if (
      editorState?.mode === "edit" &&
      editorState.padId === pad.id
    ) {
      return;
    }

    if (!canDiscardPadChanges()) {
      return;
    }

    setHasUnsavedChanges(false);
    setEditorState({ mode: "edit", padId: pad.id });
  };

  const handleBoardSelect = async (boardId: string) => {
    if (boardId === activeBoardId) {
      return;
    }

    if (!canDiscardPadChanges()) {
      return;
    }

    setActiveBoardId(boardId);
    setBoardEditorState(null);
    resetPadEditor();
    await updateSettings({
      activeBoardId: boardId,
    });
    const nextPads = await repositoryInstance.listPadSummaries(boardId);

    setPads(nextPads);
  };

  const handleCreateBoard = async () => {
    const fallbackName = getNextBoardName(boards);
    const nextBoard = await repositoryInstance.createBoard({
      name: fallbackName,
    });
    const [, nextBoards] = await Promise.all([
      updateSettings({
        activeBoardId: nextBoard.id,
      }),
      repositoryInstance.listBoards(),
    ]);

    setBoards(nextBoards);
    setActiveBoardId(nextBoard.id);
    setIsManagingPads(false);
    setPads([]);
    resetPadEditor();
    setBoardEditorState({
      boardId: nextBoard.id,
      draftName: fallbackName,
    });
  };

  const refreshPads = async (boardId: string) => {
    const nextPads = await repositoryInstance.listPadSummaries(boardId);

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
    volumeOverride: number | null;
  }) => {
    if (!activeBoardId) {
      return;
    }

    const nextOrder =
      editorState?.mode === "edit" && editedPad
        ? editedPad.order
        : Math.max(0, ...pads.map((pad) => pad.order)) + 1;

    const normalizedLabel = normalizePadName(value.label);
    const hasReplacedAudio =
      !editedPad ||
      value.audioBlob !== editedPad.audioBlob ||
      value.audioName !== editedPad.audioName ||
      value.mimeType !== editedPad.mimeType;
    const savedPad = value.id
      ? await repositoryInstance.savePad({
          id: value.id,
          boardId: activeBoardId,
          label: normalizedLabel,
          color: value.color,
          order: nextOrder,
          ...(hasReplacedAudio
            ? {
                audioBlob: value.audioBlob,
                audioName: value.audioName,
                mimeType: value.mimeType,
              }
            : {}),
          volumeOverride: value.volumeOverride,
        })
      : await repositoryInstance.savePad({
          boardId: activeBoardId,
          label: normalizedLabel,
          color: value.color,
          order: nextOrder,
          audioBlob: value.audioBlob,
          audioName: value.audioName,
          mimeType: value.mimeType,
          volumeOverride: value.volumeOverride,
        });

    padCacheRef.current.set(savedPad.id, savedPad);

    await refreshPads(activeBoardId);
    setHasUnsavedChanges(false);

    if (isManagingPads && value.id) {
      setEditedPad(savedPad);
      setEditorState({ mode: "edit", padId: savedPad.id });
      return;
    }

    setCreateEditorVersion((current) => current + 1);
    setEditorState(null);
  };

  const handleDeletePad = async () => {
    if (!activeBoardId || !editedPad) {
      return;
    }

    await repositoryInstance.deletePad(editedPad.id);
    padCacheRef.current.delete(editedPad.id);
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
      volumeOverride: editedPad.volumeOverride,
    });
    await repositoryInstance.savePad({
      id: targetPad.id,
      boardId: targetPad.boardId,
      label: targetPad.label,
      color: targetPad.color,
      order: editedPad.order,
      volumeOverride: targetPad.volumeOverride,
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
        draftName: limitBoardNameInput(value),
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
    const boardPads = await repositoryInstance.listPadSummaries(boardId);

    if (
      boardPads.length > 0 &&
      !window.confirm(DELETE_BOARD_MESSAGE)
    ) {
      return;
    }

    for (const boardPad of boardPads) {
      padCacheRef.current.delete(boardPad.id);
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
        ? await repositoryInstance.listPadSummaries(nextActiveBoardId)
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
      setIsManagingPads(false);
      setPads([]);
      resetPadEditor();
    }
  };

  const handleConcurrentPlaybackToggle = async (value: boolean) => {
    await updateSettings({
      allowConcurrentPlayback: value,
    });

    playerInstance.setAllowConcurrentPlayback(value);
  };

  const handleDefaultPadVolumeChange = (value: number) => {
    setDefaultPadVolumeDraft(value);
  };

  const handleShowStopAllButtonChange = async (value: boolean) => {
    await updateSettings({
      showStopAllButton: value,
    });
  };

  const handleChooseAudioOutput = async () => {
    setAudioOutputError(null);
    setIsChoosingAudioOutput(true);

    try {
      const selection = await selectAudioOutput({
        deviceId: settings?.preferredOutputDeviceId ?? null,
      });

      await updateSettings({
        preferredOutputDeviceId: selection.deviceId,
        preferredOutputDeviceLabel:
          selection.label || "Selected output device",
      });
      if (audioOutputCapabilities.canEnumerateOutputs) {
        setAudioOutputDevices(await listAudioOutputDevices());
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setAudioOutputError(
        "Couldn't choose an audio output device. The app will keep using the system default output device.",
      );
    } finally {
      setIsChoosingAudioOutput(false);
    }
  };

  const handleSelectListedAudioOutput = async (device: AudioOutputDevice) => {
    setAudioOutputError(null);
    await updateSettings({
      preferredOutputDeviceId: device.deviceId,
      preferredOutputDeviceLabel: device.label,
    });
  };

  const handleRequestAudioPermission = async () => {
    setAudioOutputError(null);
    setIsRequestingAudioPermission(true);

    try {
      await requestAudioInputPermission();
      const devices = await listAudioOutputDevices();

      setAudioOutputDevices(devices);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setAudioOutputError(
        "Microphone permission was not granted, so some output devices may remain unavailable.",
      );
    } finally {
      setIsRequestingAudioPermission(false);
    }
  };

  const handleResetAudioOutput = async () => {
    setAudioOutputError(null);
    await updateSettings({
      preferredOutputDeviceId: null,
      preferredOutputDeviceLabel: null,
    });
  };

  const handlePlay = async (pad: SoundboardPadSummary) => {
    const loadedPad = await getPad(pad.id);

    if (!loadedPad) {
      return;
    }

    await playerInstance.play(loadedPad.audioBlob, {
      outputDeviceId: settings?.preferredOutputDeviceId ?? null,
      volume: loadedPad.volumeOverride ?? effectiveDefaultPadVolume,
    });
  };

  const handlePreview = async (value: { audioBlob: Blob; volume: number }) => {
    await playerInstance.play(value.audioBlob, {
      outputDeviceId: settings?.preferredOutputDeviceId ?? null,
      volume: value.volume,
    });
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
                      maxLength={BOARD_NAME_MAX_LENGTH}
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
              {settings?.showStopAllButton ? (
                <button
                  className="rounded-full border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/70"
                  onClick={() => playerInstance.stopAll()}
                  type="button"
                >
                  Stop All
                </button>
              ) : null}
              <button
                className="rounded-full border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/70"
                onClick={() => setIsSettingsDialogOpen(true)}
                type="button"
              >
                Settings
              </button>
              <button
                className="rounded-full border border-[var(--color-line)] px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors duration-200 hover:bg-white/70"
                onClick={toggleManagePads}
                type="button"
              >
                {isManagingPads ? "Done" : "Manage Pads"}
              </button>
              <button
                className="rounded-full bg-[var(--color-ink)] px-4 py-3 text-sm font-medium text-[var(--color-paper)] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                disabled={isManagingPads}
                onClick={openCreatePadEditor}
                type="button"
              >
                New Pad
              </button>
            </div>
          </header>

          <SettingsDialog
            audioOutputCapabilities={audioOutputCapabilities}
            audioOutputDevices={audioOutputDevices}
            audioOutputError={audioOutputError}
            isChoosingAudioOutput={isChoosingAudioOutput}
            isLoadingAudioOutputDevices={isLoadingAudioOutputDevices}
            isRequestingAudioPermission={isRequestingAudioPermission}
            onChooseAudioOutput={() => void handleChooseAudioOutput()}
            open={isSettingsDialogOpen}
            onAllowConcurrentPlaybackChange={(value) =>
              void handleConcurrentPlaybackToggle(value)
            }
            onClose={() => setIsSettingsDialogOpen(false)}
            onDefaultPadVolumeChange={(value) =>
              void handleDefaultPadVolumeChange(value)
            }
            onRequestAudioPermission={() => void handleRequestAudioPermission()}
            onResetAudioOutput={() => void handleResetAudioOutput()}
            onSelectListedAudioOutput={(device) =>
              void handleSelectListedAudioOutput(device)
            }
            onShowStopAllButtonChange={(value) =>
              void handleShowStopAllButtonChange(value)
            }
            settings={{
              allowConcurrentPlayback: settings?.allowConcurrentPlayback ?? true,
              defaultPadVolume: effectiveDefaultPadVolume,
              preferredOutputDeviceId:
                settings?.preferredOutputDeviceId ?? null,
              preferredOutputDeviceLabel:
                settings?.preferredOutputDeviceLabel ?? null,
              showStopAllButton: settings?.showStopAllButton ?? true,
            }}
          />

          <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_320px] md:px-8 md:py-7">
            <PadGrid
              isManaging={isManagingPads}
              onPlay={(pad) => void handlePlay(pad)}
              onSelect={selectPadForManagement}
              pads={pads}
              selectedPadId={selectedManagePadId}
            />
            {isManagingPads && editorState?.mode !== "edit" ? (
              <aside className="rounded-[28px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.56)] p-5">
                <div className="space-y-3">
                  <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                    Inspector
                  </p>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                    Select a pad to manage
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    Click a pad to edit it. Click the same selected pad again to
                    preview it, or use the Preview button after selecting one.
                  </p>
                </div>
              </aside>
            ) : editorState?.mode === "edit" && isLoadingEditedPad ? (
              <aside className="rounded-[28px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.56)] p-5">
                <div className="space-y-3">
                  <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                    Inspector
                  </p>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                    Loading Sound Pad
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    Fetching the selected sound from local storage.
                  </p>
                </div>
              </aside>
            ) : editorState?.mode === "edit" && !editedPad ? (
              <aside className="rounded-[28px] border border-[var(--color-line)] bg-[rgba(255,255,255,0.56)] p-5">
                <div className="space-y-3">
                  <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                    Inspector
                  </p>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                    Sound Pad Unavailable
                  </h3>
                  <p className="text-sm leading-6 text-[var(--color-muted)]">
                    The selected sound could not be loaded from local storage.
                  </p>
                </div>
              </aside>
            ) : (
              <PadEditor
                key={
                  editorState?.mode === "edit"
                    ? editorState.padId
                    : `${activeBoardId ?? "none"}-${createEditorVersion}`
                }
                canMoveDown={editedPadIndex >= 0 && editedPadIndex < pads.length - 1}
                canMoveUp={editedPadIndex > 0}
                defaultPadVolume={effectiveDefaultPadVolume}
                mode={editorState?.mode === "edit" ? "edit" : "create"}
                onDelete={() => void handleDeletePad()}
                onDirtyChange={setHasUnsavedChanges}
                onMoveDown={() => void movePad(1)}
                onMoveUp={() => void movePad(-1)}
                onPreview={(value) => void handlePreview(value)}
                onSave={handleEditorSave}
                pad={editedPad}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
