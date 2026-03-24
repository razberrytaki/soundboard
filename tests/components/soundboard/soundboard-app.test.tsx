import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SoundboardApp } from "@/components/soundboard/soundboard-app";
import type {
  SoundboardBoard,
  SoundboardPad,
  SoundboardRepository,
  SoundboardSettings,
} from "@/lib/soundboard/types";

function createRepositoryFixture({
  boards,
  padsByBoardId,
  settings,
}: {
  boards: SoundboardBoard[];
  padsByBoardId: Record<string, SoundboardPad[]>;
  settings: SoundboardSettings;
}) {
  let currentSettings = settings;

  const repository = {
    createBoard: vi.fn(async ({ name }: { name: string }) => {
      const board: SoundboardBoard = {
        id: `board-${boards.length + 1}`,
        name,
        order: boards.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      boards.push(board);

      if (!currentSettings.activeBoardId) {
        currentSettings = {
          ...currentSettings,
          activeBoardId: board.id,
        };
      }

      return board;
    }),
    listBoards: vi.fn(async () => boards),
    getSettings: vi.fn(async () => currentSettings),
    updateSettings: vi.fn(async (patch: Partial<SoundboardSettings>) => {
      currentSettings = {
        ...currentSettings,
        ...patch,
      };

      return currentSettings;
    }),
    savePad: vi.fn(),
    listPads: vi.fn(async (boardId: string) => padsByBoardId[boardId] ?? []),
    deletePad: vi.fn(),
  } satisfies SoundboardRepository;

  return repository;
}

function createPad(overrides: Partial<SoundboardPad>): SoundboardPad {
  return {
    id: "pad-1",
    boardId: "board-1",
    label: "Airhorn",
    color: "#d95b43",
    order: 1,
    audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
    audioName: "airhorn.mp3",
    mimeType: "audio/mpeg",
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("SoundboardApp", () => {
  it("restores the active board and renders its pads", async () => {
    const boards: SoundboardBoard[] = [
      {
        id: "board-1",
        name: "Stream",
        order: 1,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      {
        id: "board-2",
        name: "Game",
        order: 2,
        createdAt: "2026-03-24T00:00:01.000Z",
        updatedAt: "2026-03-24T00:00:01.000Z",
      },
    ];
    const repository = createRepositoryFixture({
      boards,
      padsByBoardId: {
        "board-1": [createPad({ boardId: "board-1", label: "Airhorn" })],
      },
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    expect(await screen.findByRole("heading", { name: "Stream" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Airhorn" })).toBeInTheDocument();
  });

  it("switches boards from the sidebar and loads the selected pads", async () => {
    const user = userEvent.setup();
    const boards: SoundboardBoard[] = [
      {
        id: "board-1",
        name: "Stream",
        order: 1,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
      {
        id: "board-2",
        name: "Game",
        order: 2,
        createdAt: "2026-03-24T00:00:01.000Z",
        updatedAt: "2026-03-24T00:00:01.000Z",
      },
    ];
    const repository = createRepositoryFixture({
      boards,
      padsByBoardId: {
        "board-1": [createPad({ boardId: "board-1", label: "Airhorn" })],
        "board-2": [createPad({ id: "pad-2", boardId: "board-2", label: "Victory" })],
      },
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: "Game" }));

    expect(await screen.findByRole("heading", { name: "Game" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Victory" })).toBeInTheDocument();
    expect(repository.updateSettings).toHaveBeenCalledWith({ activeBoardId: "board-2" });
  });

  it("renders an empty state when there are no boards", async () => {
    const repository = createRepositoryFixture({
      boards: [],
      padsByBoardId: {},
      settings: {
        activeBoardId: null,
        allowConcurrentPlayback: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    expect(await screen.findByText(/create your first board/i)).toBeInTheDocument();
  });

  it("renders an empty state when the active board has no pads", async () => {
    const boards: SoundboardBoard[] = [
      {
        id: "board-1",
        name: "Stream",
        order: 1,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
    ];
    const repository = createRepositoryFixture({
      boards,
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    expect(await screen.findByText(/no sounds yet/i)).toBeInTheDocument();
  });
});
