import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SoundboardApp } from "@/components/soundboard/soundboard-app";
import { createSoundboardDb } from "@/lib/soundboard/db";

function makeDbName() {
  return `soundboard-component-test-${crypto.randomUUID()}`;
}

function createPlayerFixture() {
  return {
    play: vi.fn(async () => undefined),
    setAllowConcurrentPlayback: vi.fn(),
    getActiveCount: vi.fn(() => 0),
    stopAll: vi.fn(),
  };
}

async function saveCurrentBoardName(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /save board name/i }));
}

async function createPad(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  filename: string,
) {
  await user.type(await screen.findByRole("textbox", { name: /^name$/i }), name);
  await user.upload(
    screen.getByLabelText(/audio file/i),
    new File([name], filename, { type: "audio/mpeg" }),
  );
  await user.click(screen.getByRole("button", { name: /save pad/i }));
}

describe("SoundboardApp persistence regressions", () => {
  it("restores a created board and saved pad after remounting with the same database", async () => {
    const user = userEvent.setup();
    const dbName = makeDbName();
    const initialView = render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await createPad(user, "Laugh", "laugh.mp3");

    expect(await screen.findByRole("button", { name: "Laugh" })).toBeInTheDocument();

    initialView.unmount();

    render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Board 1" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Laugh" })).toBeInTheDocument();
  });

  it("restores the selected active board after switching boards and remounting", async () => {
    const user = userEvent.setup();
    const dbName = makeDbName();
    const initialView = render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await user.click(screen.getByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await user.click(screen.getByRole("button", { name: "Board 1" }));

    expect(await screen.findByRole("heading", { name: "Board 1" })).toBeInTheDocument();

    initialView.unmount();

    render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Board 1" })).toBeInTheDocument();
  });

  it("restores pad order after reordering and remounting", async () => {
    const user = userEvent.setup();
    const dbName = makeDbName();
    const initialView = render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await createPad(user, "Airhorn", "airhorn.mp3");
    await createPad(user, "Clap", "clap.mp3");
    await user.click(screen.getByRole("button", { name: /edit airhorn/i }));
    await user.click(screen.getByRole("button", { name: /move down/i }));

    await waitFor(() => {
      const padButtons = screen.getAllByRole("button", {
        name: /^(Airhorn|Clap)$/,
      });

      expect(padButtons[0]).toHaveAccessibleName("Clap");
      expect(padButtons[1]).toHaveAccessibleName("Airhorn");
    });

    initialView.unmount();

    render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await waitFor(() => {
      const padButtons = screen.getAllByRole("button", {
        name: /^(Airhorn|Clap)$/,
      });

      expect(padButtons[0]).toHaveAccessibleName("Clap");
      expect(padButtons[1]).toHaveAccessibleName("Airhorn");
    });
  });

  it("keeps the next board selected after deleting the active board and remounting", async () => {
    const user = userEvent.setup();
    const dbName = makeDbName();
    const initialView = render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await user.click(screen.getByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await user.click(screen.getByRole("button", { name: "Board 1" }));
    await user.click(screen.getByRole("button", { name: /delete board 1/i }));

    expect(await screen.findByRole("heading", { name: "Board 2" })).toBeInTheDocument();

    initialView.unmount();

    render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Board 2" })).toBeInTheDocument();
  });

  it("returns to the empty workspace after deleting the last board and remounting", async () => {
    const user = userEvent.setup();
    const dbName = makeDbName();
    const initialView = render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await user.click(screen.getByRole("button", { name: /delete board 1/i }));

    expect(await screen.findByText(/create your first board/i)).toBeInTheDocument();

    initialView.unmount();

    render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    expect(await screen.findByText(/create your first board/i)).toBeInTheDocument();
  });

  it("restores the concurrent playback toggle after remounting", async () => {
    const user = userEvent.setup();
    const dbName = makeDbName();
    const initialView = render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /create board/i }));
    await saveCurrentBoardName(user);
    await user.click(
      screen.getByRole("checkbox", { name: /allow concurrent playback/i }),
    );

    expect(
      screen.getByRole("checkbox", { name: /allow concurrent playback/i }),
    ).not.toBeChecked();

    initialView.unmount();

    render(
      <SoundboardApp
        player={createPlayerFixture()}
        repository={createSoundboardDb(dbName)}
      />,
    );

    expect(
      await screen.findByRole("checkbox", { name: /allow concurrent playback/i }),
    ).not.toBeChecked();
  });
});
