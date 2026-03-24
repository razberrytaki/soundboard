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
  createdAt: string;
  updatedAt: string;
};

export type SoundboardSettings = {
  activeBoardId: string | null;
  allowConcurrentPlayback: boolean;
};

export type CreateBoardInput = {
  name: string;
};

export type UpdateBoardInput = {
  id: string;
  name: string;
};

export type SavePadInput = {
  id?: string;
  boardId: string;
  label: string;
  color: string;
  order: number;
  audioBlob: Blob;
  audioName: string;
  mimeType: string;
};

export type UpdateSettingsInput = Partial<SoundboardSettings>;

export type SoundboardRepository = {
  createBoard(input: CreateBoardInput): Promise<SoundboardBoard>;
  updateBoard(input: UpdateBoardInput): Promise<SoundboardBoard>;
  deleteBoard(boardId: string): Promise<void>;
  listBoards(): Promise<SoundboardBoard[]>;
  getSettings(): Promise<SoundboardSettings>;
  updateSettings(input: UpdateSettingsInput): Promise<SoundboardSettings>;
  savePad(input: SavePadInput): Promise<SoundboardPad>;
  listPads(boardId: string): Promise<SoundboardPad[]>;
  deletePad(padId: string): Promise<void>;
};
