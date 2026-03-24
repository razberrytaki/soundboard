// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createSoundboardDb } from "@/lib/soundboard/db";

function makeDbName() {
  return `soundboard-test-${crypto.randomUUID()}`;
}

describe("createSoundboardDb", () => {
  it("creates the first board and restores it as active", async () => {
    const db = createSoundboardDb(makeDbName());

    const board = await db.createBoard({ name: "Stream" });
    const settings = await db.getSettings();

    expect(board.name).toBe("Stream");
    expect(settings.activeBoardId).toBe(board.id);
    expect(settings.allowConcurrentPlayback).toBe(true);
  });

  it("lists boards in created order", async () => {
    const db = createSoundboardDb(makeDbName());

    await db.createBoard({ name: "Stream" });
    await db.createBoard({ name: "Game" });

    const boards = await db.listBoards();

    expect(boards.map((board) => board.name)).toEqual(["Stream", "Game"]);
  });

  it("stores pads with blobs and returns them sorted by order", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

    await db.savePad({
      boardId: board.id,
      label: "Airhorn",
      color: "#d95b43",
      order: 2,
      audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });

    await db.savePad({
      boardId: board.id,
      label: "Clap",
      color: "#34645e",
      order: 1,
      audioBlob: new Blob(["b"], { type: "audio/mpeg" }),
      audioName: "clap.mp3",
      mimeType: "audio/mpeg",
    });

    const pads = await db.listPads(board.id);

    expect(pads.map((pad) => pad.label)).toEqual(["Clap", "Airhorn"]);
    expect(pads[0]?.audioBlob.type).toBe("audio/mpeg");
    expect(pads[0]?.audioBlob.size).toBe(1);
  });

  it("updates global playback settings", async () => {
    const db = createSoundboardDb(makeDbName());

    await db.updateSettings({ allowConcurrentPlayback: false });

    const settings = await db.getSettings();

    expect(settings.allowConcurrentPlayback).toBe(false);
  });

  it("deletes a stored pad", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Reactions" });
    const pad = await db.savePad({
      boardId: board.id,
      label: "Laugh",
      color: "#4a507a",
      order: 1,
      audioBlob: new Blob(["c"], { type: "audio/mpeg" }),
      audioName: "laugh.mp3",
      mimeType: "audio/mpeg",
    });

    await db.deletePad(pad.id);

    const pads = await db.listPads(board.id);

    expect(pads).toHaveLength(0);
  });
});
