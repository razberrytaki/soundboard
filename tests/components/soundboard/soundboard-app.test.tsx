import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SoundboardApp } from "@/components/soundboard/soundboard-app";
import type {
  SoundboardBoard,
  SoundboardPad,
  SoundboardRepository,
  SoundboardSettings,
} from "@/lib/soundboard/types";

const audioOutputSupport = vi.hoisted(() => ({
  capabilities: {
    secureContext: true,
    canRouteOutput: true,
    canPromptSelection: true,
    canEnumerateOutputs: true,
    canRequestInputPermission: true,
  },
  selectAudioOutput: vi.fn(),
  listAudioOutputDevices: vi.fn(async () => []),
  requestAudioInputPermission: vi.fn(async () => undefined),
}));

vi.mock("@/lib/soundboard/audio-output", () => ({
  getAudioOutputCapabilities: () => audioOutputSupport.capabilities,
  supportsAudioOutputRouting: () => true,
  selectAudioOutput: (options?: { deviceId?: string | null }) =>
    audioOutputSupport.selectAudioOutput(options),
  listAudioOutputDevices: () => audioOutputSupport.listAudioOutputDevices(),
  requestAudioInputPermission: () =>
    audioOutputSupport.requestAudioInputPermission(),
}));

function createRepositoryFixture({
  boards,
  padsByBoardId,
  settings,
}: {
  boards: SoundboardBoard[];
  padsByBoardId: Record<string, SoundboardPad[]>;
  settings: Partial<SoundboardSettings>;
}) {
  let currentSettings: SoundboardSettings = {
    activeBoardId: null,
    allowConcurrentPlayback: true,
    defaultPadVolume: 100,
    showStopAllButton: true,
    preferredOutputDeviceId: null,
    preferredOutputDeviceLabel: null,
    ...settings,
  };
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
        volumeOverride:
          input.volumeOverride === undefined
            ? existingPad?.volumeOverride ?? null
            : input.volumeOverride,
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
    volumeOverride: null,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    ...overrides,
  };
}

async function enterManagePads(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: /manage pads/i }),
  );
}

async function selectPadForManagement(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(await screen.findByRole("button", { name }));
}

afterEach(() => {
  vi.useRealTimers();
  audioOutputSupport.capabilities = {
    secureContext: true,
    canRouteOutput: true,
    canPromptSelection: true,
    canEnumerateOutputs: true,
    canRequestInputPermission: true,
  };
  audioOutputSupport.selectAudioOutput.mockReset();
  audioOutputSupport.listAudioOutputDevices.mockReset();
  audioOutputSupport.requestAudioInputPermission.mockReset();
  vi.clearAllMocks();
});

describe("SoundboardApp", () => {
  it("opens and closes the settings dialog", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
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

    await user.click(await screen.findByRole("button", { name: /settings/i }));

    expect(await screen.findByRole("dialog", { name: /settings/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^close$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /settings/i })).not.toBeInTheDocument();
    });
  });

  it("saves a default pad volume change from the settings dialog", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
        defaultPadVolume: 100,
        showStopAllButton: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: /settings/i }));
    fireEvent.change(screen.getByRole("slider", { name: /default pad volume/i }), {
      target: { value: "35" },
    });

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({ defaultPadVolume: 35 });
    });
  });

  it("toggles allow concurrent playback from the settings dialog", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
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

    await user.click(await screen.findByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("checkbox", { name: /allow concurrent playback/i }));

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({
        allowConcurrentPlayback: false,
      });
    });
    expect(player.setAllowConcurrentPlayback).toHaveBeenCalledWith(false);
  });

  it("toggles show stop all button from the settings dialog", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
        showStopAllButton: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("checkbox", { name: /show stop all button/i }));

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({
        showStopAllButton: false,
      });
    });
  });

  it("shows the unsupported browser explanation for audio output selection", async () => {
    audioOutputSupport.capabilities = {
      secureContext: true,
      canRouteOutput: false,
      canPromptSelection: false,
      canEnumerateOutputs: false,
      canRequestInputPermission: false,
    };

    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
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

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /settings/i }));

    expect(
      await screen.findByText(/audio output selection is not supported in this browser/i),
    ).toBeInTheDocument();
  });

  it("lists available output devices when the browser can route audio but not open a picker", async () => {
    const user = userEvent.setup();
    audioOutputSupport.capabilities = {
      secureContext: true,
      canRouteOutput: true,
      canPromptSelection: false,
      canEnumerateOutputs: true,
      canRequestInputPermission: true,
    };
    audioOutputSupport.listAudioOutputDevices.mockResolvedValue([
      { deviceId: "default", label: "System Default" },
      { deviceId: "speaker-1", label: "Desk Speakers" },
    ]);
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
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

    await user.click(await screen.findByRole("button", { name: /settings/i }));
    await screen.findByRole("button", { name: /use desk speakers/i });

    await user.click(screen.getByRole("button", { name: /use desk speakers/i }));

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({
        preferredOutputDeviceId: "speaker-1",
        preferredOutputDeviceLabel: "Desk Speakers",
      });
    });
  });

  it("explains why microphone permission may be requested to reveal more output devices", async () => {
    const user = userEvent.setup();
    audioOutputSupport.capabilities = {
      secureContext: true,
      canRouteOutput: true,
      canPromptSelection: false,
      canEnumerateOutputs: true,
      canRequestInputPermission: true,
    };
    audioOutputSupport.listAudioOutputDevices.mockResolvedValue([]);
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
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

    await user.click(await screen.findByRole("button", { name: /settings/i }));

    expect(
      await screen.findByText(/temporary microphone permission/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this does not start recording/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /grant access to more devices/i }),
    );

    expect(audioOutputSupport.requestAudioInputPermission).toHaveBeenCalledTimes(1);
  });

  it("saves a chosen audio output device from the settings dialog", async () => {
    const user = userEvent.setup();
    audioOutputSupport.selectAudioOutput.mockResolvedValue({
      deviceId: "speaker-1",
      label: "Desk Speakers",
    });
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
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

    await user.click(await screen.findByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /choose device/i }));

    await waitFor(() => {
      expect(audioOutputSupport.selectAudioOutput).toHaveBeenCalledWith({
        deviceId: null,
      });
    });
    expect(repository.updateSettings).toHaveBeenCalledWith({
      preferredOutputDeviceId: "speaker-1",
      preferredOutputDeviceLabel: "Desk Speakers",
    });
  });

  it("clears the preferred audio output device back to system default", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
        preferredOutputDeviceId: "speaker-1",
        preferredOutputDeviceLabel: "Desk Speakers",
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /use system default/i }));

    await waitFor(() => {
      expect(repository.updateSettings).toHaveBeenCalledWith({
        preferredOutputDeviceId: null,
        preferredOutputDeviceLabel: null,
      });
    });
  });

  it("shows the stop all button only when enabled", async () => {
    const enabledRepository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
        showStopAllButton: true,
      },
    });
    const disabledRepository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
        showStopAllButton: false,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    const { unmount } = render(
      <SoundboardApp repository={enabledRepository} player={player} />,
    );

    expect(await screen.findByRole("button", { name: /stop all/i })).toBeInTheDocument();

    unmount();
    render(<SoundboardApp repository={disabledRepository} player={player} />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /stop all/i })).not.toBeInTheDocument();
    });
  });

  it("calls stopAll from the header button", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {},
      settings: {
        activeBoardId: "board-1",
        allowConcurrentPlayback: true,
        showStopAllButton: true,
      },
    });
    const player = {
      play: vi.fn(async () => undefined),
      setAllowConcurrentPlayback: vi.fn(),
      getActiveCount: vi.fn(() => 0),
      stopAll: vi.fn(),
    };

    render(<SoundboardApp repository={repository} player={player} />);

    await user.click(await screen.findByRole("button", { name: /stop all/i }));

    expect(player.stopAll).toHaveBeenCalledTimes(1);
  });

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

    expect(player.play).toHaveBeenCalledWith(airhornPad.audioBlob, {
      outputDeviceId: null,
      volume: 100,
    });
  });

  it("passes the preferred output device id into playback", async () => {
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
        preferredOutputDeviceId: "speaker-1",
        preferredOutputDeviceLabel: "Desk Speakers",
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

    expect(player.play).toHaveBeenCalledWith(airhornPad.audioBlob, {
      outputDeviceId: "speaker-1",
      volume: 100,
    });
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

  it("prompts before discarding a dirty draft when entering manage pads mode", async () => {
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
    await user.click(screen.getByRole("button", { name: /manage pads/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Discard unsaved changes?\nYour current pad edits will be lost.",
    );
    expect(screen.getByRole("heading", { name: "Add Sound Pad" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^name$/i })).toHaveValue(
      "Draft pad",
    );

    confirmSpy.mockRestore();
  });

  it("selects a pad in manage mode without triggering playback, then plays on the second click", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {
        "board-1": [createPad({ id: "pad-1", boardId: "board-1", label: "Airhorn" })],
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Airhorn");

    expect(
      screen.getByRole("heading", { name: /edit sound pad/i }),
    ).toBeInTheDocument();
    expect(player.play).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^airhorn$/i }));

    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("previews the selected pad from the inspector in manage mode", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {
        "board-1": [createPad({ id: "pad-1", boardId: "board-1", label: "Airhorn" })],
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Airhorn");
    await user.click(screen.getByRole("button", { name: /preview/i }));

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.play.mock.calls[0]?.[1]).toMatchObject({ volume: 100 });
  });

  it("returns to normal playback mode after leaving manage pads", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {
        "board-1": [createPad({ id: "pad-1", boardId: "board-1", label: "Airhorn" })],
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Airhorn");
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /^airhorn$/i }));

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: /add sound pad/i }),
    ).toBeInTheDocument();
  });

  it("disables New Pad while manage pads is active", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryFixture({
      boards: [
        {
          id: "board-1",
          name: "Stream",
          order: 1,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
      padsByBoardId: {
        "board-1": [createPad({ id: "pad-1", boardId: "board-1", label: "Airhorn" })],
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

    await enterManagePads(user);

    expect(screen.getByRole("button", { name: /new pad/i })).toBeDisabled();
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Airhorn");
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Airhorn");
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Clap");
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

    await enterManagePads(user);
    await selectPadForManagement(user, "Airhorn");
    await user.click(screen.getByRole("button", { name: /move down/i }));

    await waitFor(() => {
      const padButtons = screen.getAllByRole("button", {
        name: /^(Airhorn|Clap)$/,
      });

      expect(padButtons[0]).toHaveAccessibleName("Clap");
      expect(padButtons[1]).toHaveAccessibleName("Airhorn");
    });
  });

});
