export const BOARD_NAME_MAX_LENGTH = 20;
export const PAD_NAME_MAX_LENGTH = 12;

export const PAD_NAME_REQUIRED_MESSAGE = "Enter a pad name.";
export const PAD_AUDIO_INVALID_MESSAGE = "Choose an audio file.";

function limitTextLength(value: string, maxLength: number) {
  return Array.from(value).slice(0, maxLength).join("");
}

export function limitBoardNameInput(value: string) {
  return limitTextLength(value, BOARD_NAME_MAX_LENGTH);
}

export function limitPadNameInput(value: string) {
  return limitTextLength(value, PAD_NAME_MAX_LENGTH);
}

export function normalizeBoardName(value: string, fallbackName: string) {
  const normalizedValue = limitBoardNameInput(value).trim();

  return normalizedValue.length > 0 ? normalizedValue : fallbackName;
}

export function normalizePadName(value: string) {
  return limitPadNameInput(value).trim();
}

export function validatePadName(value: string) {
  return normalizePadName(value).length > 0 ? null : PAD_NAME_REQUIRED_MESSAGE;
}

export function validateAudioFile(file: File | null | undefined) {
  if (!file) {
    return null;
  }

  return file.type.startsWith("audio/") ? null : PAD_AUDIO_INVALID_MESSAGE;
}
