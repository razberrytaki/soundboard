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
  let boardCounter = boards.length + 1;
  const mutablePads = Object.fromEntries(
    Object.entries(padsByBoardId).map(([boardId, pads]) => [boardId, [...pads]]),
  ) as Record<string, SoundboardPad[]>;

  const repository = {
    createBoard: vi.fn(async ({ name }: { name: string }) => {
      const board: SoundboardBoard = {
        id: `board-${boardCounter}`,
        name,
        order: boardCounter,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      boardCounter += 1;
      boards.push(board);
      mutablePads[board.id] = [];

      if (!currentSettings.activeBoardId) {
        currentSettings = {
          ...currentSettings,
          activeBoardId: board.id,
        };
      }

      return board;
    }),
    updateBoard: vi.fn(async ({ id, name }: { id: string; name: string }) => {
      const board = boards.find((entry) => entry.id === id);

      if (!board) {
        throw new Error(`Board not found: ${id}`);
      }

      board.name = name;
      board.updatedAt = new Date().toISOString();

      return board;
    }),
    deleteBoard: vi.fn(async (boardId: string) => {
      const deletedBoardIndex = boards.findIndex((board) => board.id === boardId);

      if (deletedBoardIndex === -1) {
        return;
      }

      boards.splice(deletedBoardIndex, 1);
      delete mutablePads[boardId];

      if (currentSettings.activeBoardId === boardId) {
        const nextBoard =
          boards[deletedBoardIndex] ?? boards[deletedBoardIndex - 1] ?? null;

        currentSettings = {
          ...currentSettings,
          activeBoardId: nextBoard?.id ?? null,
        };
      }
    }),
    listBoards: vi.fn(async () => [...boards]),
    getSettings: vi.fn(async () => ({ ...currentSettings })),
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

    expect(await screen.findByRole("textbox", { name: /board name/i })).toHaveValue(
      "Board 1",
    );
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
    await user.click(screen.getByRole("button", { name: /save board name/i }));

    expect(await screen.findByRole("heading", { name: "Board 2" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Board 2" })).toBeInTheDocument();
  });

  it("puts a newly created board into inline rename mode", async () => {
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

    expect(await screen.findByRole("textbox", { name: /board name/i })).toHaveValue(
      "Board 2",
    );
  });

  it("renames an existing board inline from the sidebar", async () => {
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

    await user.click(await screen.findByRole("button", { name: /rename stream/i }));
    await user.clear(screen.getByRole("textbox", { name: /board name/i }));
    await user.type(screen.getByRole("textbox", { name: /board name/i }), "Studio");
    await user.click(screen.getByRole("button", { name: /save board name/i }));

    expect(await screen.findByRole("heading", { name: "Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Studio" })).toBeInTheDocument();
  });

  it("saves a board rename when Enter is pressed in the name field", async () => {
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

    await user.click(await screen.findByRole("button", { name: /rename stream/i }));
    await user.clear(screen.getByRole("textbox", { name: /board name/i }));
    await user.type(screen.getByRole("textbox", { name: /board name/i }), "Studio");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { name: "Studio" })).toBeInTheDocument();
    expect(repository.updateBoard).toHaveBeenCalledWith({
      id: "board-1",
      name: "Studio",
    });
  });

  it("cancels a board rename when Escape is pressed in the name field", async () => {
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

    await user.click(await screen.findByRole("button", { name: /rename stream/i }));
    await user.clear(screen.getByRole("textbox", { name: /board name/i }));
    await user.type(screen.getByRole("textbox", { name: /board name/i }), "Studio");
    await user.keyboard("{Escape}");

    expect(await screen.findByRole("heading", { name: "Stream" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /board name/i })).not.toBeInTheDocument();
    expect(repository.updateBoard).not.toHaveBeenCalled();
  });

  it("keeps the generated fallback name when a new board name is blank", async () => {
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
    await user.clear(screen.getByRole("textbox", { name: /board name/i }));
    await user.type(screen.getByRole("textbox", { name: /board name/i }), "   ");
    await user.click(screen.getByRole("button", { name: /save board name/i }));

    expect(await screen.findByRole("heading", { name: "Board 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board 2" })).toBeInTheDocument();
    expect(repository.updateBoard).not.toHaveBeenCalled();
  });

  it("keeps board management actions out of the sidebar", async () => {
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

    expect(await screen.findByRole("button", { name: /rename stream/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete stream/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rename game/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete game/i })).not.toBeInTheDocument();
  });

  it("deletes an empty board without confirmation", async () => {
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
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: "Game" }));
    await user.click(await screen.findByRole("button", { name: /delete game/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Game" })).not.toBeInTheDocument();
    });
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("asks for confirmation before deleting a board with pads", async () => {
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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: "Game" }));
    await user.click(await screen.findByRole("button", { name: /delete game/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Delete this board?\nThis board contains saved sound pads. Deleting it will remove them from this browser.",
    );
    expect(screen.getByRole("button", { name: "Game" })).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it("selects the next board when deleting the active board", async () => {
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

    await user.click(await screen.findByRole("button", { name: /delete stream/i }));

    expect(await screen.findByRole("heading", { name: "Game" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Victory" })).toBeInTheDocument();
  });

  it("returns to the empty workspace after deleting the last board", async () => {
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

    await user.click(await screen.findByRole("button", { name: /delete stream/i }));

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

    await user.click(await screen.findByRole("button", { name: /new pad/i }));
    await user.type(screen.getByRole("textbox", { name: /^name$/i }), "Laugh");
    await user.upload(
      screen.getByLabelText(/audio file/i),
      new File(["laugh"], "laugh.mp3", { type: "audio/mpeg" }),
    );
    await user.click(screen.getByRole("button", { name: /save pad/i }));

    expect(await screen.findByRole("button", { name: "Laugh" })).toBeInTheDocument();
    expect(repository.savePad).toHaveBeenCalled();
  });

  it("trims pad names before saving", async () => {
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

    await user.type(
      await screen.findByRole("textbox", { name: /^name$/i }),
      "  Laugh  ",
    );
    await user.upload(
      screen.getByLabelText(/audio file/i),
      new File(["laugh"], "laugh.mp3", { type: "audio/mpeg" }),
    );
    await user.click(screen.getByRole("button", { name: /save pad/i }));

    expect(repository.savePad).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Laugh",
      }),
    );
    expect(await screen.findByRole("button", { name: "Laugh" })).toBeInTheDocument();
  });

  it("shows an inline error for whitespace-only pad names and blocks saving", async () => {
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

    const nameInput = await screen.findByRole("textbox", { name: /^name$/i });

    await user.type(nameInput, "   ");
    await user.tab();

    expect(await screen.findByText(/enter a pad name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save pad/i })).toBeDisabled();
  });

  it("rejects non-audio files with an inline error", async () => {
    const user = userEvent.setup({ applyAccept: false });
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

    await user.type(
      await screen.findByRole("textbox", { name: /^name$/i }),
      "Laugh",
    );
    await user.upload(
      screen.getByLabelText(/audio file/i),
      new File(["note"], "note.txt", { type: "text/plain" }),
    );

    expect(await screen.findByText(/choose an audio file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save pad/i })).toBeDisabled();
    expect(repository.savePad).not.toHaveBeenCalled();
  });

  it("limits the pad name input length to 12 characters", async () => {
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

    expect(
      await screen.findByRole("textbox", { name: /^name$/i }),
    ).toHaveAttribute("maxlength", "12");
  });

  it("keeps the inspector open and uses new pad as the create action label", async () => {
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

    expect(await screen.findByRole("button", { name: /new pad/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("prompts before discarding a dirty draft when starting a new pad", async () => {
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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SoundboardApp repository={repository} player={player} />);

    await user.type(
      await screen.findByRole("textbox", { name: /^name$/i }),
      "Draft pad",
    );
    await user.click(screen.getByRole("button", { name: /new pad/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Discard unsaved changes?\nYour current pad edits will be lost.",
    );
    expect(screen.getByRole("textbox", { name: /^name$/i })).toHaveValue(
      "Draft pad",
    );

    confirmSpy.mockRestore();
  });

  it("prompts before discarding a dirty draft when switching into edit mode", async () => {
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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SoundboardApp repository={repository} player={player} />);

    await user.type(
      await screen.findByRole("textbox", { name: /^name$/i }),
      "Draft pad",
    );
    await user.click(screen.getByRole("button", { name: /edit airhorn/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Discard unsaved changes?\nYour current pad edits will be lost.",
    );
    expect(screen.getByRole("heading", { name: "Add Sound Pad" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^name$/i })).toHaveValue(
      "Draft pad",
    );

    confirmSpy.mockRestore();
  });

  it("prompts before discarding a dirty draft when switching boards", async () => {
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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<SoundboardApp repository={repository} player={player} />);

    await user.type(
      await screen.findByRole("textbox", { name: /^name$/i }),
      "Draft pad",
    );
    await user.click(screen.getByRole("button", { name: "Game" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Discard unsaved changes?\nYour current pad edits will be lost.",
    );
    expect(screen.getByRole("heading", { name: "Stream" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^name$/i })).toHaveValue(
      "Draft pad",
    );

    confirmSpy.mockRestore();
  });

  it("discards a dirty draft when confirmation is accepted during board switching", async () => {
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
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SoundboardApp repository={repository} player={player} />);

    await user.type(
      await screen.findByRole("textbox", { name: /^name$/i }),
      "Draft pad",
    );
    await user.click(screen.getByRole("button", { name: "Game" }));

    expect(await screen.findByRole("heading", { name: "Game" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^name$/i })).toHaveValue("");
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
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
    await user.clear(screen.getByRole("textbox", { name: /^name$/i }));
    await user.type(screen.getByRole("textbox", { name: /^name$/i }), "Crowd");
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

  it("moves a pad downward without drag and drop", async () => {
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

    await user.click(await screen.findByRole("button", { name: /edit airhorn/i }));
    await user.click(screen.getByRole("button", { name: /move down/i }));

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
