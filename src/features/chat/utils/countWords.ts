const WORD_PATTERN = /\S+/gu;

export const countWords = (text: string): number => {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return 0;
  }

  const matches = normalized.match(WORD_PATTERN);
  return matches?.length ?? 0;
};
