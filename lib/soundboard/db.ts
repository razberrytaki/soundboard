import { defaultSoundboardSettings } from "@/lib/soundboard/defaults";
import type {
  CreateBoardInput,
  SavePadInput,
  SoundboardBoard,
  SoundboardPad,
  SoundboardPadSummary,
  SoundboardRepository,
  SoundboardSettings,
  UpdateBoardInput,
  UpdateSettingsInput,
} from "@/lib/soundboard/types";

const DATABASE_VERSION = 3;
const BOARDS_STORE = "boards";
const PADS_STORE = "pads";
const PAD_AUDIO_STORE = "pad-audio";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "app";

type SettingsRecord = SoundboardSettings & {
  key: typeof SETTINGS_KEY;
};

type PadRecord = SoundboardPadSummary;

type PadAudioRecord = {
  id: string;
  audioBlob: Blob;
};

type SavePadInputWithAudio = SavePadInput & {
  audioBlob: Blob;
  audioName: string;
  mimeType: string;
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

function normalizePadRecord(record: PadRecord | SoundboardPad): PadRecord {
  return {
    id: record.id,
    boardId: record.boardId,
    label: record.label,
    color: record.color,
    order: record.order,
    audioName: record.audioName,
    mimeType: record.mimeType,
    volumeOverride: record.volumeOverride ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPublicSettings(record: SettingsRecord): SoundboardSettings {
  const { key, ...settings } = record;

  void key;

  return settings;
}

function toPublicPad(
  record: PadRecord | undefined,
  audioRecord: PadAudioRecord | undefined,
): SoundboardPad | null {
  if (!record || !audioRecord) {
    return null;
  }

  return {
    ...record,
    audioBlob: audioRecord.audioBlob,
  };
}

function hasAudioFields(input: SavePadInput): input is SavePadInputWithAudio {
  return (
    input.audioBlob instanceof Blob &&
    typeof input.audioName === "string" &&
    typeof input.mimeType === "string"
  );
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

      if (!database.objectStoreNames.contains(PAD_AUDIO_STORE)) {
        database.createObjectStore(PAD_AUDIO_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }

      if (!transaction) {
        return;
      }

      if (oldVersion < 2) {
        const settingsStore = transaction.objectStore(SETTINGS_STORE);
        const settingsRequest = settingsStore.get(SETTINGS_KEY) as IDBRequest<
          SettingsRecord | undefined
        >;

        settingsRequest.onsuccess = () => {
          settingsStore.put(
            normalizeSettingsRecord(settingsRequest.result ?? undefined),
          );
        };
      }

      if (oldVersion < 3) {
        const padsStore = transaction.objectStore(PADS_STORE);
        const padAudioStore = transaction.objectStore(PAD_AUDIO_STORE);
        const padsRequest = padsStore.openCursor() as IDBRequest<
          IDBCursorWithValue | null
        >;

        padsRequest.onsuccess = () => {
          const cursor = padsRequest.result;

          if (!cursor) {
            return;
          }

          const record = cursor.value as SoundboardPad | PadRecord;

          cursor.update(normalizePadRecord(record));

          if ("audioBlob" in record && record.audioBlob instanceof Blob) {
            padAudioStore.put({
              id: record.id,
              audioBlob: record.audioBlob,
            } satisfies PadAudioRecord);
          }

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

function sortPadRecords(records: PadRecord[]) {
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
        [BOARDS_STORE, PADS_STORE, PAD_AUDIO_STORE, SETTINGS_STORE],
        "readwrite",
      );
      const boardStore = transaction.objectStore(BOARDS_STORE);
      const padStore = transaction.objectStore(PADS_STORE);
      const padAudioStore = transaction.objectStore(PAD_AUDIO_STORE);
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
        padAudioStore.delete(key);
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

    async getPad(padId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(
        [PADS_STORE, PAD_AUDIO_STORE],
        "readonly",
      );
      const padStore = transaction.objectStore(PADS_STORE);
      const padAudioStore = transaction.objectStore(PAD_AUDIO_STORE);
      const [record, audioRecord] = await Promise.all([
        requestToPromise(
          padStore.get(padId) as IDBRequest<PadRecord | undefined>,
        ),
        requestToPromise(
          padAudioStore.get(padId) as IDBRequest<PadAudioRecord | undefined>,
        ),
      ]);

      await transactionDone(transaction);

      return toPublicPad(record ? normalizePadRecord(record) : undefined, audioRecord);
    },

    async savePad(input: SavePadInput) {
      const database = await getDatabase();
      const transaction = database.transaction(
        [PADS_STORE, PAD_AUDIO_STORE],
        "readwrite",
      );
      const padStore = transaction.objectStore(PADS_STORE);
      const padAudioStore = transaction.objectStore(PAD_AUDIO_STORE);
      const existing =
        "id" in input
          ? await requestToPromise(
              padStore.get(input.id) as IDBRequest<PadRecord | undefined>,
            )
          : undefined;
      const existingAudio =
        "id" in input
          ? await requestToPromise(
              padAudioStore.get(input.id) as IDBRequest<PadAudioRecord | undefined>,
            )
          : undefined;

      if (!hasAudioFields(input) && !existingAudio) {
        transaction.abort();
        throw new Error("Audio file is required when creating a pad.");
      }

      const now = nextTimestamp(existing?.updatedAt);
      const nextPadId = "id" in input ? input.id : crypto.randomUUID();
      const nextAudioName = hasAudioFields(input)
        ? input.audioName
        : existing?.audioName ?? "";
      const nextMimeType = hasAudioFields(input)
        ? input.mimeType
        : existing?.mimeType ?? "";
      const nextRecord: PadRecord = {
        id: nextPadId,
        boardId: input.boardId,
        label: input.label,
        color: input.color,
        order: input.order,
        audioName: nextAudioName,
        mimeType: nextMimeType,
        volumeOverride:
          input.volumeOverride === undefined
            ? existing?.volumeOverride ?? null
            : input.volumeOverride,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      padStore.put(nextRecord);

      if (hasAudioFields(input)) {
        padAudioStore.put({
          id: nextPadId,
          audioBlob: input.audioBlob,
        } satisfies PadAudioRecord);
      }

      await transactionDone(transaction);

      return {
        ...nextRecord,
        audioBlob: hasAudioFields(input)
          ? input.audioBlob
          : existingAudio!.audioBlob,
      };
    },

    async listPads(boardId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(
        [PADS_STORE, PAD_AUDIO_STORE],
        "readonly",
      );
      const padStore = transaction.objectStore(PADS_STORE);
      const padAudioStore = transaction.objectStore(PAD_AUDIO_STORE);
      const padIndex = padStore.index("boardId");
      const padRecords = await requestToPromise(
        padIndex.getAll(IDBKeyRange.only(boardId)) as IDBRequest<PadRecord[]>,
      );
      const sortedRecords = sortPadRecords(
        padRecords.map((record) => normalizePadRecord(record)),
      );
      const audioRecords = await Promise.all(
        sortedRecords.map((record) =>
          requestToPromise(
            padAudioStore.get(record.id) as IDBRequest<PadAudioRecord | undefined>,
          ),
        ),
      );

      await transactionDone(transaction);

      return sortedRecords.reduce<SoundboardPad[]>((pads, record, index) => {
        const pad = toPublicPad(record, audioRecords[index]);

        if (pad) {
          pads.push(pad);
        }

        return pads;
      }, []);
    },

    async listPadSummaries(boardId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(PADS_STORE, "readonly");
      const store = transaction.objectStore(PADS_STORE);
      const index = store.index("boardId");
      const pads = await requestToPromise(
        index.getAll(IDBKeyRange.only(boardId)) as IDBRequest<PadRecord[]>,
      );

      return sortPadRecords(pads.map((record) => normalizePadRecord(record)));
    },

    async deletePad(padId: string) {
      const database = await getDatabase();
      const transaction = database.transaction(
        [PADS_STORE, PAD_AUDIO_STORE],
        "readwrite",
      );

      transaction.objectStore(PADS_STORE).delete(padId);
      transaction.objectStore(PAD_AUDIO_STORE).delete(padId);
      await transactionDone(transaction);
    },
  };
}
