export type SoundboardBoard = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type SoundboardPad = {
  id: string;
  boardId: string;
  label: string;
  color: string;
  order: number;
  audioBlob: Blob;
  audioName: string;
  mimeType: string;
  volumeOverride: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SoundboardPadSummary = Omit<SoundboardPad, "audioBlob">;

export type SoundboardSettings = {
  activeBoardId: string | null;
  allowConcurrentPlayback: boolean;
  defaultPadVolume: number;
  showStopAllButton: boolean;
  preferredOutputDeviceId: string | null;
  preferredOutputDeviceLabel: string | null;
};

export type CreateBoardInput = {
  name: string;
};

export type UpdateBoardInput = {
  id: string;
  name: string;
};

export type CreatePadInput = {
  boardId: string;
  label: string;
  color: string;
  order: number;
  audioBlob: Blob;
  audioName: string;
  mimeType: string;
  volumeOverride?: number | null;
};

export type UpdatePadInput = {
  id: string;
  boardId: string;
  label: string;
  color: string;
  order: number;
  audioBlob?: Blob;
  audioName?: string;
  mimeType?: string;
  volumeOverride?: number | null;
};

export type SavePadInput = CreatePadInput | UpdatePadInput;

export type UpdateSettingsInput = Partial<SoundboardSettings>;

export type SoundboardRepository = {
  createBoard(input: CreateBoardInput): Promise<SoundboardBoard>;
  updateBoard(input: UpdateBoardInput): Promise<SoundboardBoard>;
  deleteBoard(boardId: string): Promise<void>;
  listBoards(): Promise<SoundboardBoard[]>;
  getSettings(): Promise<SoundboardSettings>;
  updateSettings(input: UpdateSettingsInput): Promise<SoundboardSettings>;
  getPad(padId: string): Promise<SoundboardPad | null>;
  savePad(input: SavePadInput): Promise<SoundboardPad>;
  listPads(boardId: string): Promise<SoundboardPad[]>;
  listPadSummaries(boardId: string): Promise<SoundboardPadSummary[]>;
  deletePad(padId: string): Promise<void>;
};
