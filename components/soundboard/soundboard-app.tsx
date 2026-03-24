"use client";

import { useEffect, useState } from "react";

import { BoardSidebar } from "@/components/soundboard/board-sidebar";
import { PadGrid } from "@/components/soundboard/pad-grid";
import { createAudioPlayer } from "@/lib/soundboard/audio-player";
import { createSoundboardDb } from "@/lib/soundboard/db";
import type {
  SoundboardBoard,
  SoundboardPad,
  SoundboardRepository,
  SoundboardSettings,
} from "@/lib/soundboard/types";

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
  }, [repositoryInstance]);

  const activeBoard =
    boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null;

  const handleBoardSelect = async (boardId: string) => {
    setActiveBoardId(boardId);
    const nextSettings = await repositoryInstance.updateSettings({
      activeBoardId: boardId,
    });
    const nextPads = await repositoryInstance.listPads(boardId);

    setSettings(nextSettings);
    setPads(nextPads);
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
          onSelectBoard={(boardId) => void handleBoardSelect(boardId)}
        />

        <section className="flex min-w-0 flex-col">
          <header className="flex flex-col gap-4 border-b border-[var(--color-line)] px-5 py-5 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[0.72rem] uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Active Board
              </p>
              <div className="space-y-1">
                <h1 className="text-4xl font-semibold tracking-[-0.05em]">
                  {activeBoard?.name}
                </h1>
                <p className="max-w-xl text-sm leading-6 text-[var(--color-muted)] md:text-base">
                  Stored locally in this browser and restored on the next visit.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.65)] px-3 py-2 text-sm text-[var(--color-muted)]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
              Concurrent Playback{" "}
              {settings?.allowConcurrentPlayback ? "On" : "Off"}
            </div>
          </header>

          <div className="px-5 py-5 md:px-8 md:py-7">
            <PadGrid pads={pads} onPlay={(pad) => void handlePlay(pad)} />
          </div>
        </section>
      </div>
    </main>
  );
}
