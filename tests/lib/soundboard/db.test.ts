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

async function readRecord<T>(database: IDBDatabase, storeName: string, key: IDBValidKey) {
  const transaction = database.transaction(storeName, "readonly");
  const record = await new Promise<T | undefined>((resolve, reject) => {
    const request = transaction.objectStore(storeName).get(key) as IDBRequest<
      T | undefined
    >;

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await transactionDone(transaction);

  return record;
}

async function openLegacyV1Database(name: string) {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("boards")) {
        database.createObjectStore("boards", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("pads")) {
        const padsStore = database.createObjectStore("pads", {
          keyPath: "id",
        });

        padsStore.createIndex("boardId", "boardId", { unique: false });
      }

      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
    };

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

  it("returns lightweight pad summaries and can read a full pad by id", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

    const savedPad = await db.savePad({
      boardId: board.id,
      label: "Airhorn",
      color: "#d95b43",
      order: 1,
      audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });

    const repository = db as typeof db & {
      getPad(padId: string): Promise<Record<string, unknown> | null>;
      listPadSummaries(boardId: string): Promise<Record<string, unknown>[]>;
    };
    const summaries = await repository.listPadSummaries(board.id);
    const fullPad = await repository.getPad(savedPad.id);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: savedPad.id,
      label: "Airhorn",
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });
    expect(summaries[0]).not.toHaveProperty("audioBlob");
    expect(fullPad).toMatchObject({
      id: savedPad.id,
      label: "Airhorn",
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });
    expect(fullPad?.audioBlob).toBeInstanceOf(Blob);
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

  it("persists and returns the full expanded global settings shape", async () => {
    const name = makeDbName();
    const db = createSoundboardDb(name);

    const updatedSettings = await db.updateSettings({
      allowConcurrentPlayback: false,
      defaultPadVolume: 72,
      showStopAllButton: false,
      preferredOutputDeviceId: "device-1",
      preferredOutputDeviceLabel: "Desk Speakers",
    });

    expect(updatedSettings).toEqual({
      activeBoardId: null,
      allowConcurrentPlayback: false,
      defaultPadVolume: 72,
      showStopAllButton: false,
      preferredOutputDeviceId: "device-1",
      preferredOutputDeviceLabel: "Desk Speakers",
    });

    const reopenedSettings = await createSoundboardDb(name).getSettings();

    expect(reopenedSettings).toEqual({
      activeBoardId: null,
      allowConcurrentPlayback: false,
      defaultPadVolume: 72,
      showStopAllButton: false,
      preferredOutputDeviceId: "device-1",
      preferredOutputDeviceLabel: "Desk Speakers",
    });
  });

  it("migrates legacy v1 records to the expanded settings and pad shape", async () => {
    const name = makeDbName();
    const legacyDatabase = await openLegacyV1Database(name);
    const boardId = crypto.randomUUID();
    const padId = crypto.randomUUID();
    const transaction = legacyDatabase.transaction(
      ["boards", "pads", "settings"],
      "readwrite",
    );

    transaction.objectStore("boards").put({
      id: boardId,
      name: "Stream",
      order: 1,
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    });
    transaction.objectStore("pads").put({
      id: padId,
      boardId,
      label: "Clap",
      color: "#34645e",
      order: 1,
      audioBlob: new Blob(["legacy"], { type: "audio/mpeg" }),
      audioName: "clap.mp3",
      mimeType: "audio/mpeg",
      createdAt: "2026-03-24T00:00:01.000Z",
      updatedAt: "2026-03-24T00:00:01.000Z",
    });
    transaction.objectStore("settings").put({
      key: "app",
      activeBoardId: boardId,
      allowConcurrentPlayback: false,
    });
    await transactionDone(transaction);
    legacyDatabase.close();

    const db = createSoundboardDb(name);
    await db.listBoards();

    const upgradedDatabase = await openRawDatabase(name);
    const migratedSettings = await readRecord<{
      key: string;
      activeBoardId: string | null;
      allowConcurrentPlayback: boolean;
      defaultPadVolume: number;
      showStopAllButton: boolean;
      preferredOutputDeviceId: string | null;
      preferredOutputDeviceLabel: string | null;
    }>(upgradedDatabase, "settings", "app");
    const migratedPad = await readRecord<{
      id: string;
      boardId: string;
      label: string;
      color: string;
      order: number;
      audioName: string;
      mimeType: string;
      volumeOverride: number | null;
      createdAt: string;
      updatedAt: string;
    }>(upgradedDatabase, "pads", padId);
    const migratedPadAudio = await readRecord<{
      id: string;
      audioBlob: Blob;
    }>(upgradedDatabase, "pad-audio", padId);
    upgradedDatabase.close();

    expect(migratedSettings).toEqual({
      key: "app",
      activeBoardId: boardId,
      allowConcurrentPlayback: false,
      defaultPadVolume: 100,
      showStopAllButton: true,
      preferredOutputDeviceId: null,
      preferredOutputDeviceLabel: null,
    });
    expect(migratedPad).toMatchObject({
      id: padId,
      boardId,
      label: "Clap",
      audioName: "clap.mp3",
      mimeType: "audio/mpeg",
      volumeOverride: null,
    });
    expect(migratedPad).not.toHaveProperty("audioBlob");
    expect(migratedPadAudio).toMatchObject({
      id: padId,
    });
    expect(migratedPadAudio?.audioBlob).toBeInstanceOf(Blob);
  });

  it("returns default settings before any records exist", async () => {
    const db = createSoundboardDb(makeDbName());

    const settings = await db.getSettings();

    expect(settings).toEqual({
      activeBoardId: null,
      allowConcurrentPlayback: true,
      defaultPadVolume: 100,
      showStopAllButton: true,
      preferredOutputDeviceId: null,
      preferredOutputDeviceLabel: null,
    });
  });

  it("defaults missing pad volume overrides to null", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

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

    expect(pads[0]?.volumeOverride).toBeNull();
  });

  it("preserves pad volume overrides on create and update", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

    const created = await db.savePad({
      boardId: board.id,
      label: "Airhorn",
      color: "#d95b43",
      order: 2,
      audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
      volumeOverride: 35,
    });

    expect(created.volumeOverride).toBe(35);

    const createdPads = await db.listPads(board.id);
    expect(createdPads[0]?.volumeOverride).toBe(35);

    const updated = await db.savePad({
      id: created.id,
      boardId: board.id,
      label: "Airhorn",
      color: "#d95b43",
      order: 2,
      audioBlob: new Blob(["c"], { type: "audio/mpeg" }),
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });

    expect(updated.volumeOverride).toBe(35);

    const updatedPads = await db.listPads(board.id);
    expect(updatedPads[0]?.volumeOverride).toBe(35);
  });

  it("preserves stored audio when updating pad metadata without resupplying the blob", async () => {
    const db = createSoundboardDb(makeDbName());
    const board = await db.createBoard({ name: "Memes" });

    const created = await db.savePad({
      boardId: board.id,
      label: "Airhorn",
      color: "#d95b43",
      order: 1,
      audioBlob: new Blob(["a"], { type: "audio/mpeg" }),
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });

    const repository = db as typeof db & {
      getPad(padId: string): Promise<{
        label: string;
        audioBlob: Blob;
        audioName: string;
        mimeType: string;
      } | null>;
      savePad(input: Record<string, unknown>): Promise<unknown>;
    };

    await repository.savePad({
      id: created.id,
      boardId: board.id,
      label: "Crowd",
      color: "#4a507a",
      order: 1,
    });

    const updated = await repository.getPad(created.id);

    expect(updated).toMatchObject({
      label: "Crowd",
      audioName: "airhorn.mp3",
      mimeType: "audio/mpeg",
    });
    expect(updated?.audioBlob.size).toBe(1);
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
