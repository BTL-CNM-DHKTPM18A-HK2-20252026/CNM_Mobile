export const DEFAULT_SPLIT_MESSAGE_MAX_WORDS = 250;
const DEFAULT_SPLIT_MESSAGE_MAX_CHARS = 3600;
const MIN_SPLIT_CHUNK_RATIO = 0.45;
const WORD_PATTERN = /\S+/gu;

const toSafeMaxWords = (maxWords?: number) => {
  if (!Number.isFinite(maxWords) || !maxWords) {
    return DEFAULT_SPLIT_MESSAGE_MAX_WORDS;
  }

  return Math.max(1, Math.floor(maxWords));
};

const countWords = (value: string) => {
  const matches = value.match(WORD_PATTERN);
  return matches?.length ?? 0;
};

const hasOverlongToken = (source: string, maxChars: number) => {
  if (maxChars <= 0) {
    return false;
  }

  WORD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = WORD_PATTERN.exec(source);

  while (match) {
    if (match[0].length > maxChars) {
      return true;
    }

    match = WORD_PATTERN.exec(source);
  }

  return false;
};

const takeFirstWords = (source: string, maxWords: number): number => {
  if (maxWords <= 0) {
    return -1;
  }

  let wordsSeen = 0;
  let splitIndex = -1;
  WORD_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null = WORD_PATTERN.exec(source);
  while (match) {
    wordsSeen += 1;
    splitIndex = match.index + match[0].length;

    if (wordsSeen >= maxWords) {
      return splitIndex;
    }

    match = WORD_PATTERN.exec(source);
  }

  return splitIndex;
};

const takeFirstCodePointChunkIndex = (source: string, maxChars: number): number => {
  if (maxChars <= 0) {
    return -1;
  }

  return Array.from(source).slice(0, maxChars).join('').length;
};

const findSplitIndexByPattern = (
  source: string,
  pattern: RegExp,
  minIndex: number,
  maxIndex: number,
  maxWords: number,
  getBreakAt: (match: RegExpExecArray) => number
) => {
  let result = -1;
  pattern.lastIndex = 0;

  let match: RegExpExecArray | null = pattern.exec(source);
  while (match) {
    const breakAt = getBreakAt(match);
    if (breakAt > maxIndex) {
      break;
    }

    const prefixWordCount = countWords(source.slice(0, breakAt));
    if (prefixWordCount >= minIndex && prefixWordCount <= maxWords) {
      result = breakAt;
    }

    match = pattern.exec(source);
  }

  return result;
};

const findBestSplitIndex = (source: string, maxWords: number) => {
  if (countWords(source) <= maxWords) {
    return source.length;
  }

  const minPreferredWords = Math.max(1, Math.floor(maxWords * MIN_SPLIT_CHUNK_RATIO));

  // Ưu tiên tách theo mức độ tự nhiên để đoạn vẫn dễ đọc.
  const strategyBreaks = [
    findSplitIndexByPattern(source, /(?:\r?\n){2,}/g, minPreferredWords, maxWords, maxWords, (match) => match.index + match[0].length),
    findSplitIndexByPattern(source, /\r?\n/g, minPreferredWords, maxWords, maxWords, (match) => match.index + match[0].length),
    findSplitIndexByPattern(source, /[.!?]+(?:["')\]]+)?\s+/g, minPreferredWords, maxWords, maxWords, (match) => match.index + match[0].length),
    findSplitIndexByPattern(source, /\s+/g, minPreferredWords, maxWords, maxWords, (match) => match.index + match[0].length),
  ];

  const preferredBreak = strategyBreaks.find((index) => index > 0);
  if (preferredBreak && preferredBreak <= source.length) {
    return preferredBreak;
  }

  return takeFirstWords(source, maxWords);
};

/**
 * Tách nội dung dài thành nhiều tin nhắn nhỏ theo trải nghiệm chat tự nhiên.
 *
 * Example usage:
 * const chunks = splitMessage(longText, 250);
 * // gửi tuần tự: for (const chunk of chunks) { await send(chunk); }
 */
export const splitMessage = (content: string, maxWords: number = DEFAULT_SPLIT_MESSAGE_MAX_WORDS): string[] => {
  const safeMaxWords = toSafeMaxWords(maxWords);
  let remaining = String(content ?? '').trim();

  if (!remaining) {
    return [];
  }

  const chunks: string[] = [];

  while (remaining.length > 0) {
    if (hasOverlongToken(remaining, DEFAULT_SPLIT_MESSAGE_MAX_CHARS)) {
      const hardCutIndex = takeFirstCodePointChunkIndex(remaining, DEFAULT_SPLIT_MESSAGE_MAX_CHARS);
      if (hardCutIndex <= 0) {
        break;
      }

      const hardChunk = remaining.slice(0, hardCutIndex).trim();
      if (hardChunk) {
        chunks.push(hardChunk);
      }

      remaining = remaining.slice(hardCutIndex).trim();
      continue;
    }

    if (countWords(remaining) <= safeMaxWords) {
      const finalChunk = remaining.trim();
      if (finalChunk) {
        chunks.push(finalChunk);
      }
      break;
    }

    const splitIndex = findBestSplitIndex(remaining, safeMaxWords);
    const head = remaining.slice(0, splitIndex).trim();
    const tail = remaining.slice(splitIndex).trim();

    if (head) {
      chunks.push(head);
    }

    if (!tail) {
      break;
    }

    // Trường hợp hiếm: split index không tiến lên (an toàn để tránh loop vô hạn).
    if (!head && tail.length === remaining.length) {
      const softCutIndex = takeFirstWords(remaining, safeMaxWords);
      if (softCutIndex <= 0) {
        break;
      }

      const softChunk = remaining.slice(0, softCutIndex).trim();
      if (softChunk) {
        chunks.push(softChunk);
      }
      remaining = remaining.slice(softCutIndex).trim();
      continue;
    }

    remaining = tail;
  }

  return chunks.filter((chunk) => chunk.length > 0);
};
