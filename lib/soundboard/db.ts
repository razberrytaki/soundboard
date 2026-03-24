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

const DATABASE_VERSION = 1;
const BOARDS_STORE = "boards";
const PADS_STORE = "pads";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "app";

type SettingsRecord = SoundboardSettings & {
  key: typeof SETTINGS_KEY;
};

function openDatabase(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

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
    if (mode === "readwrite") {
      await transactionDone(transaction);
    }

    return existing;
  }

  if (mode !== "readwrite") {
    transaction.abort();

    return {
      key: SETTINGS_KEY,
      ...defaultSoundboardSettings,
    } satisfies SettingsRecord;
  }

  const record = {
    key: SETTINGS_KEY,
    ...defaultSoundboardSettings,
  } satisfies SettingsRecord;

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
      const board: SoundboardBoard = {
        id: crypto.randomUUID(),
        name: input.name,
        order: existingBoards.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

      const nextSettings: SettingsRecord = {
        key: SETTINGS_KEY,
        ...(existingSettings ?? defaultSoundboardSettings),
        activeBoardId: existingSettings?.activeBoardId ?? board.id,
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
        updatedAt: new Date().toISOString(),
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

      const currentSettings: SettingsRecord = {
        key: SETTINGS_KEY,
        ...(existingSettings ?? defaultSoundboardSettings),
      };
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

      return {
        activeBoardId: settings.activeBoardId,
        allowConcurrentPlayback: settings.allowConcurrentPlayback,
      } satisfies SoundboardSettings;
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

      return {
        activeBoardId: nextSettings.activeBoardId,
        allowConcurrentPlayback: nextSettings.allowConcurrentPlayback,
      } satisfies SoundboardSettings;
    },

    async savePad(input: SavePadInput) {
      const database = await getDatabase();
      const transaction = database.transaction(PADS_STORE, "readwrite");
      const store = transaction.objectStore(PADS_STORE);
      const now = new Date().toISOString();
      const existing =
        input.id === undefined
          ? undefined
          : await requestToPromise(
              store.get(input.id) as IDBRequest<SoundboardPad | undefined>,
            );
      const pad: SoundboardPad = {
        id: input.id ?? crypto.randomUUID(),
        boardId: input.boardId,
        label: input.label,
        color: input.color,
        order: input.order,
        audioBlob: input.audioBlob,
        audioName: input.audioName,
        mimeType: input.mimeType,
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

      return [...pads].sort((left, right) => {
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
