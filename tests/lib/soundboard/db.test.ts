// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createSoundboardDb } from "@/lib/soundboard/db";

function makeDbName() {
  return `soundboard-test-${crypto.randomUUID()}`;
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openRawDatabase(name: string) {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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

  it("breaks board order ties by created timestamp", async () => {
    const name = makeDbName();
    const db = createSoundboardDb(name);
    const stream = await db.createBoard({ name: "Stream" });
    const game = await db.createBoard({ name: "Game" });
    const rawDatabase = await openRawDatabase(name);
    const transaction = rawDatabase.transaction("boards", "readwrite");
    const store = transaction.objectStore("boards");

    store.put({
      ...stream,
      order: 1,
      createdAt: "2026-03-24T00:00:02.000Z",
    });
    store.put({
      ...game,
      order: 1,
      createdAt: "2026-03-24T00:00:01.000Z",
    });
    await transactionDone(transaction);

    const boards = await db.listBoards();

    expect(boards.map((board) => board.name)).toEqual(["Game", "Stream"]);
    rawDatabase.close();
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

  it("breaks pad order ties by created timestamp", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

    await db.savePad({
      boardId: board.id,
      label: "Airhorn",
      color: "#d95b43",
      order: 1,
      audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });
    await new Promise((resolve) => setTimeout(resolve, 1));
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

    expect(pads.map((pad) => pad.label)).toEqual(["Airhorn", "Clap"]);
  });

  it("updates global playback settings", async () => {
    const db = createSoundboardDb(makeDbName());

    await db.updateSettings({ allowConcurrentPlayback: false });

    const settings = await db.getSettings();

    expect(settings.allowConcurrentPlayback).toBe(false);
  });

  it("returns default settings before any records exist", async () => {
    const db = createSoundboardDb(makeDbName());

    const settings = await db.getSettings();

    expect(settings).toEqual({
      activeBoardId: null,
      allowConcurrentPlayback: true,
    });
  });

  it("renames a board and refreshes its updated timestamp", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Stream" });
    await new Promise((resolve) => setTimeout(resolve, 1));

    await db.updateBoard({
      id: board.id,
      name: "Studio",
    });

    const boards = await db.listBoards();

    expect(boards[0]?.name).toBe("Studio");
    expect(boards[0]?.updatedAt).not.toBe(board.updatedAt);
  });

  it("rejects attempts to rename a missing board", async () => {
    const db = createSoundboardDb(makeDbName());

    await expect(
      db.updateBoard({
        id: "missing-board",
        name: "Studio",
      }),
    ).rejects.toThrow("Board not found: missing-board");
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

  it("preserves createdAt when updating an existing pad", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Reactions" });
    const original = await db.savePad({
      boardId: board.id,
      label: "Laugh",
      color: "#4a507a",
      order: 1,
      audioBlob: new Blob(["c"], { type: "audio/mpeg" }),
      audioName: "laugh.mp3",
      mimeType: "audio/mpeg",
    });

    await new Promise((resolve) => setTimeout(resolve, 1));

    const updated = await db.savePad({
      id: original.id,
      boardId: board.id,
      label: "Crowd",
      color: "#4a507a",
      order: 1,
      audioBlob: new Blob(["d"], { type: "audio/mpeg" }),
      audioName: "crowd.mp3",
      mimeType: "audio/mpeg",
    });

    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).not.toBe(original.updatedAt);
    expect(updated.label).toBe("Crowd");
  });

  it("deletes a board together with its pads", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

    await db.savePad({
      boardId: board.id,
      label: "Laugh",
      color: "#4a507a",
      order: 1,
      audioBlob: new Blob(["c"], { type: "audio/mpeg" }),
      audioName: "laugh.mp3",
      mimeType: "audio/mpeg",
    });

    await db.deleteBoard(board.id);

    const [boards, pads, settings] = await Promise.all([
      db.listBoards(),
      db.listPads(board.id),
      db.getSettings(),
    ]);

    expect(boards).toHaveLength(0);
    expect(pads).toHaveLength(0);
    expect(settings.activeBoardId).toBeNull();
  });

  it("promotes the next board when deleting the active board", async () => {
    const db = createSoundboardDb(makeDbName());
    const boardOne = await db.createBoard({ name: "Stream" });
    const boardTwo = await db.createBoard({ name: "Game" });
    const boardThree = await db.createBoard({ name: "Memes" });

    await db.updateSettings({ activeBoardId: boardTwo.id });
    await db.deleteBoard(boardTwo.id);

    const [boards, settings] = await Promise.all([
      db.listBoards(),
      db.getSettings(),
    ]);

    expect(boards.map((board) => board.id)).toEqual([boardOne.id, boardThree.id]);
    expect(settings.activeBoardId).toBe(boardThree.id);
  });

  it("keeps the active board when deleting a different board", async () => {
    const db = createSoundboardDb(makeDbName());
    const boardOne = await db.createBoard({ name: "Stream" });
    const boardTwo = await db.createBoard({ name: "Game" });

    await db.updateSettings({ activeBoardId: boardOne.id });
    await db.deleteBoard(boardTwo.id);

    const [boards, settings] = await Promise.all([
      db.listBoards(),
      db.getSettings(),
    ]);

    expect(boards.map((board) => board.id)).toEqual([boardOne.id]);
    expect(settings.activeBoardId).toBe(boardOne.id);
  });

  it("falls back to the first board when the active board id points at a missing record", async () => {
    const db = createSoundboardDb(makeDbName());
    const boardOne = await db.createBoard({ name: "Stream" });
    const boardTwo = await db.createBoard({ name: "Game" });

    await db.updateSettings({ activeBoardId: "missing-board" });
    await db.deleteBoard("missing-board");

    const [boards, settings] = await Promise.all([
      db.listBoards(),
      db.getSettings(),
    ]);

    expect(boards.map((board) => board.id)).toEqual([boardOne.id, boardTwo.id]);
    expect(settings.activeBoardId).toBe(boardOne.id);
  });
});
