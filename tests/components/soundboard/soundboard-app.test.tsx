import { render, screen, waitFor } from "@testing-library/react";
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
  let padCounter = 10;
  const mutablePads = Object.fromEntries(
    Object.entries(padsByBoardId).map(([boardId, pads]) => [boardId, [...pads]]),
  ) as Record<string, SoundboardPad[]>;

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
    savePad: vi.fn(async (input) => {
      const existingPads = [...(mutablePads[input.boardId] ?? [])];
      const existingPad = input.id
        ? existingPads.find((pad) => pad.id === input.id)
        : undefined;
      const now = new Date().toISOString();
      const nextPad: SoundboardPad = {
        id: input.id ?? `pad-${padCounter++}`,
        boardId: input.boardId,
        label: input.label,
        color: input.color,
        order: input.order,
        audioBlob: input.audioBlob,
        audioName: input.audioName,
        mimeType: input.mimeType,
        createdAt: existingPad?.createdAt ?? now,
        updatedAt: now,
      };
      const nextPads = existingPads.filter((pad) => pad.id !== nextPad.id);

      nextPads.push(nextPad);
      mutablePads[input.boardId] = nextPads.sort((left, right) => left.order - right.order);

      return nextPad;
    }),
    listPads: vi.fn(async (boardId: string) => [
      ...(mutablePads[boardId] ?? []),
    ].sort((left, right) => left.order - right.order)),
    deletePad: vi.fn(async (padId: string) => {
      for (const [boardId, pads] of Object.entries(mutablePads)) {
        mutablePads[boardId] = pads.filter((pad) => pad.id !== padId);
      }
    }),
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

  it("creates the first board from the empty state", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole("button", { name: /create board/i }));

    expect(await screen.findByRole("heading", { name: "Board 1" })).toBeInTheDocument();
  });

  it("creates another board from the sidebar", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole("button", { name: /create board/i }));

    expect(await screen.findByRole("heading", { name: "Board 2" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Board 2" })).toBeInTheDocument();
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

  it("plays a pad when the user clicks it", async () => {
    const user = userEvent.setup();
    const boards: SoundboardBoard[] = [
      {
        id: "board-1",
        name: "Stream",
        order: 1,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
    ];
    const airhornPad = createPad({ boardId: "board-1", label: "Airhorn" });
    const repository = createRepositoryFixture({
      boards,
      padsByBoardId: {
        "board-1": [airhornPad],
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

    await user.click(await screen.findByRole("button", { name: "Airhorn" }));

    expect(player.play).toHaveBeenCalledWith(airhornPad.audioBlob);
  });

  it("adds a new pad from the editor form", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole("button", { name: /add sound/i }));
    await user.type(screen.getByLabelText(/name/i), "Laugh");
    await user.upload(
      screen.getByLabelText(/audio file/i),
      new File(["laugh"], "laugh.mp3", { type: "audio/mpeg" }),
    );
    await user.click(screen.getByRole("button", { name: /save pad/i }));

    expect(await screen.findByRole("button", { name: "Laugh" })).toBeInTheDocument();
    expect(repository.savePad).toHaveBeenCalled();
  });

  it("edits an existing pad", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole("button", { name: /edit airhorn/i }));
    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), "Crowd");
    await user.click(screen.getByRole("button", { name: /save pad/i }));

    expect(await screen.findByRole("button", { name: "Crowd" })).toBeInTheDocument();
  });

  it("deletes a pad from the editor", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole("button", { name: /edit airhorn/i }));
    await user.click(screen.getByRole("button", { name: /delete pad/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Airhorn" })).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/no sounds yet/i)).toBeInTheDocument();
  });

  it("moves a pad upward without drag and drop", async () => {
    const user = userEvent.setup();
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
      padsByBoardId: {
        "board-1": [
          createPad({ id: "pad-1", boardId: "board-1", label: "Airhorn", order: 1 }),
          createPad({ id: "pad-2", boardId: "board-1", label: "Clap", order: 2 }),
        ],
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

    await user.click(await screen.findByRole("button", { name: /edit clap/i }));
    await user.click(screen.getByRole("button", { name: /move up/i }));

    await waitFor(() => {
      const padButtons = screen.getAllByRole("button", {
        name: /^(Airhorn|Clap)$/,
      });

      expect(padButtons[0]).toHaveAccessibleName("Clap");
      expect(padButtons[1]).toHaveAccessibleName("Airhorn");
    });
  });

  it("toggles concurrent playback from settings", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole("checkbox", { name: /allow concurrent playback/i }));

    expect(repository.updateSettings).toHaveBeenCalledWith({
      allowConcurrentPlayback: false,
    });
    expect(player.setAllowConcurrentPlayback).toHaveBeenCalledWith(false);
  });
});
