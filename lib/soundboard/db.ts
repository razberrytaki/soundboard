import { defaultSoundboardSettings } from "@/lib/soundboard/defaults";
import type {
  CreateBoardInput,
  SavePadInput,
  SoundboardBoard,
  SoundboardPad,
  SoundboardRepository,
  SoundboardSettings,
  UpdateBoardInput,
  UpdateSettingsInput,
} from "@/lib/soundboard/types";

const DATABASE_VERSION = 2;
const BOARDS_STORE = "boards";
const PADS_STORE = "pads";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "app";

type SettingsRecord = SoundboardSettings & {
  key: typeof SETTINGS_KEY;
};

function normalizeSettingsRecord(
  record: Partial<SoundboardSettings> | undefined,
): SettingsRecord {
  return {
    key: SETTINGS_KEY,
    ...defaultSoundboardSettings,
    ...(record ?? {}),
  };
}

function normalizePadRecord(record: SoundboardPad): SoundboardPad {
  return {
    ...record,
    volumeOverride: record.volumeOverride ?? null,
  };
}

function toPublicSettings(record: SettingsRecord): SoundboardSettings {
  const { key: _key, ...settings } = record;

  return settings;
}

function openDatabase(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      const oldVersion = event.oldVersion;

      if (!database.objectStoreNames.contains(BOARDS_STORE)) {
        database.createObjectStore(BOARDS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(PADS_STORE)) {
        const padsStore = database.createObjectStore(PADS_STORE, {
          keyPath: "id",
        });

        padsStore.createIndex("boardId", "boardId", { unique: false });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }

      if (transaction && oldVersion < 2) {
        const settingsStore = transaction.objectStore(SETTINGS_STORE);
        const padsStore = transaction.objectStore(PADS_STORE);
        const settingsRequest = settingsStore.get(SETTINGS_KEY) as IDBRequest<
          SettingsRecord | undefined
        >;
        const padsRequest = padsStore.openCursor() as IDBRequest<IDBCursorWithValue | null>;

        settingsRequest.onsuccess = () => {
          settingsStore.put(
            normalizeSettingsRecord(settingsRequest.result ?? undefined),
          );
        };

        padsRequest.onsuccess = () => {
          const cursor = padsRequest.result;

          if (!cursor) {
            return;
          }

          cursor.update(normalizePadRecord(cursor.value as SoundboardPad));
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readSettings(
  database: IDBDatabase,
  mode: IDBTransactionMode = "readonly",
) {
  const transaction = database.transaction(SETTINGS_STORE, mode);
  const store = transaction.objectStore(SETTINGS_STORE);
  const existing = await requestToPromise(
    store.get(SETTINGS_KEY) as IDBRequest<SettingsRecord | undefined>,
  );

  if (existing) {
    const normalized = normalizeSettingsRecord(existing);

    if (mode === "readwrite") {
      store.put(normalized);
      await transactionDone(transaction);
    }

    return normalized;
  }

  if (mode !== "readwrite") {
    transaction.abort();

    return normalizeSettingsRecord(undefined);
  }

  const record = normalizeSettingsRecord(undefined);

  store.put(record);
  await transactionDone(transaction);

  return record;
}

function sortBoards(records: SoundboardBoard[]) {
  return [...records].sort((left, right) => {
    if (left.order === right.order) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.order - right.order;
  });
}

function getNextActiveBoardId(
  records: SoundboardBoard[],
  deletedBoardId: string,
) {
  const sortedBoards = sortBoards(records);
  const deletedBoardIndex = sortedBoards.findIndex(
    (board) => board.id === deletedBoardId,
  );

  if (deletedBoardIndex === -1) {
    return sortedBoards[0]?.id ?? null;
  }

  return (
    sortedBoards[deletedBoardIndex + 1]?.id ??
    sortedBoards[deletedBoardIndex - 1]?.id ??
    null
  );
}

function nextTimestamp(previous?: string) {
  const now = Date.now();

  if (!previous) {
    return new Date(now).toISOString();
  }

  const previousTime = Date.parse(previous);

  if (Number.isNaN(previousTime)) {
    return new Date(now).toISOString();
  }

  return new Date(Math.max(now, previousTime + 1)).toISOString();
}

export function createSoundboardDb(name = "soundboard"): SoundboardRepository {
  let databasePromise: Promise<IDBDatabase> | undefined;

  const getDatabase = () => {
    if (!databasePromise) {
      databasePromise = openDatabase(name);
    }

    return databasePromise;
  };

  return {
    async createBoard(input: CreateBoardInput) {
      const database = await getDatabase();
      const existingBoards = await this.listBoards();
      const now = nextTimestamp();
      const board: SoundboardBoard = {
        id: crypto.randomUUID(),
        name: input.name,
        order: existingBoards.length + 1,
        createdAt: now,
        updatedAt: now,
      };

      const transaction = database.transaction(
        [BOARDS_STORE, SETTINGS_STORE],
        "readwrite",
      );
      const boardStore = transaction.objectStore(BOARDS_STORE);
      const settingsStore = transaction.objectStore(SETTINGS_STORE);
      const existingSettings = await requestToPromise(
        settingsStore.get(SETTINGS_KEY) as IDBRequest<SettingsRecord | undefined>,
      );

      boardStore.put(board);

      const currentSettings = normalizeSettingsRecord(existingSettings);
      const nextSettings: SettingsRecord = {
        ...currentSettings,
        activeBoardId: currentSettings.activeBoardId ?? board.id,
      };

      settingsStore.put(nextSettings);
      await transactionDone(transaction);

      return board;
    },

    async updateBoard(input: UpdateBoardInput) {
      const database = await getDatabase();
      const transaction = database.transaction(BOARDS_STORE, "readwrite");
      const store = transaction.objectStore(BOARDS_STORE);
      const existing = await requestToPromise(
        store.get(input.id) as IDBRequest<SoundboardBoard | undefined>,
      );

      if (!existing) {
        transaction.abort();
        throw new Error(`Board not found: ${input.id}`);
      }

      const nextBoard: SoundboardBoard = {
        ...existing,
        name: input.name,
        updatedAt: nextTimestamp(existing.updatedAt),
      };

      store.put(nextBoard);
      await transactionDone(transaction);

      return nextBoard;
    },

    async deleteBoard(boardId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(
        [BOARDS_STORE, PADS_STORE, SETTINGS_STORE],
        "readwrite",
      );
      const boardStore = transaction.objectStore(BOARDS_STORE);
      const padStore = transaction.objectStore(PADS_STORE);
      const settingsStore = transaction.objectStore(SETTINGS_STORE);
      const padIndex = padStore.index("boardId");
      const [boards, existingSettings, padKeys] = await Promise.all([
        requestToPromise(
          boardStore.getAll() as IDBRequest<SoundboardBoard[]>,
        ),
        requestToPromise(
          settingsStore.get(SETTINGS_KEY) as IDBRequest<SettingsRecord | undefined>,
        ),
        requestToPromise(
          padIndex.getAllKeys(IDBKeyRange.only(boardId)) as IDBRequest<
            IDBValidKey[]
          >,
        ),
      ]);

      boardStore.delete(boardId);

      for (const key of padKeys) {
        padStore.delete(key);
      }

      const currentSettings = normalizeSettingsRecord(existingSettings);
      const nextSettings: SettingsRecord = {
        ...currentSettings,
        activeBoardId:
          currentSettings.activeBoardId === boardId
            ? getNextActiveBoardId(boards, boardId)
            : currentSettings.activeBoardId,
      };

      settingsStore.put(nextSettings);
      await transactionDone(transaction);
    },

    async listBoards() {
      const database = await getDatabase();
      const transaction = database.transaction(BOARDS_STORE, "readonly");
      const boards = await requestToPromise(
        transaction.objectStore(BOARDS_STORE).getAll() as IDBRequest<
          SoundboardBoard[]
        >,
      );

      return sortBoards(boards);
    },

    async getSettings() {
      const database = await getDatabase();
      const settings = await readSettings(database, "readwrite");

      return toPublicSettings(normalizeSettingsRecord(settings));
    },

    async updateSettings(input: UpdateSettingsInput) {
      const database = await getDatabase();
      const current = await readSettings(database, "readwrite");
      const transaction = database.transaction(SETTINGS_STORE, "readwrite");
      const store = transaction.objectStore(SETTINGS_STORE);
      const nextSettings: SettingsRecord = {
        ...current,
        ...input,
      };

      store.put(nextSettings);
      await transactionDone(transaction);

      return toPublicSettings(normalizeSettingsRecord(nextSettings));
    },

    async savePad(input: SavePadInput) {
      const database = await getDatabase();
      const transaction = database.transaction(PADS_STORE, "readwrite");
      const store = transaction.objectStore(PADS_STORE);
      const existing =
        input.id === undefined
          ? undefined
          : await requestToPromise(
              store.get(input.id) as IDBRequest<SoundboardPad | undefined>,
            );
      const now = nextTimestamp(existing?.updatedAt);
      const pad: SoundboardPad = {
        id: input.id ?? crypto.randomUUID(),
        boardId: input.boardId,
        label: input.label,
        color: input.color,
        order: input.order,
        audioBlob: input.audioBlob,
        audioName: input.audioName,
        mimeType: input.mimeType,
        volumeOverride:
          input.volumeOverride === undefined
            ? existing?.volumeOverride ?? null
            : input.volumeOverride,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      store.put(pad);
      await transactionDone(transaction);

      return pad;
    },

    async listPads(boardId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(PADS_STORE, "readonly");
      const store = transaction.objectStore(PADS_STORE);
      const index = store.index("boardId");
      const pads = await requestToPromise(
        index.getAll(IDBKeyRange.only(boardId)) as IDBRequest<SoundboardPad[]>,
      );

      return [...pads]
        .map((pad) => normalizePadRecord(pad))
        .sort((left, right) => {
          if (left.order === right.order) {
            return left.createdAt.localeCompare(right.createdAt);
          }

          return left.order - right.order;
        });
    },

    async deletePad(padId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(PADS_STORE, "readwrite");

      transaction.objectStore(PADS_STORE).delete(padId);
      await transactionDone(transaction);
    },
  };
}
