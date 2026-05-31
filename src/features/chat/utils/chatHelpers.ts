import type { ChatUiReaction } from '../services/chatMessageAdapter';
import type { Message } from '../types/chatTypes';

export const emojiToReactionType = (emoji: string): 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY' => {
  switch (emoji) {
    case '❤️':
      return 'LOVE';
    case '😆':
      return 'HAHA';
    case '😮':
      return 'WOW';
    case '😭':
      return 'SAD';
    case '😡':
      return 'ANGRY';
    default:
      return 'LIKE';
  }
};

export const buildReactionSummary = (reactions?: ChatUiReaction[]) => {
  if (!Array.isArray(reactions) || reactions.length === 0) {
    return [] as Array<{ emoji: string; count: number }>;
  }

  const counter = new Map<string, number>();
  reactions.forEach((reaction) => {
    const emoji = reaction.emoji || '👍';
    counter.set(emoji, (counter.get(emoji) || 0) + 1);
  });

  return Array.from(counter.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji));
};

export const pad2 = (value: number) => String(value).padStart(2, '0');

export const toLocalIsoString = (date: Date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const getVietnamDateParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year ?? date.getFullYear()),
    month: Number(values.month ?? date.getMonth() + 1),
    day: Number(values.day ?? date.getDate()),
    hour: Number(values.hour ?? date.getHours()),
    minute: Number(values.minute ?? date.getMinutes()),
    second: Number(values.second ?? date.getSeconds()),
  };
};

const buildVietnamDate = (createdAt?: string) => {
  if (!createdAt) return null;

  const raw = String(createdAt).trim();
  if (!raw) return null;

  const epoch = Number(raw);
  if (!Number.isNaN(epoch)) {
    return new Date(epoch);
  }

  const hasExplicitTimeZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (hasExplicitTimeZone) {
    return parsed;
  }

  const [datePart, timePart] = raw.split('T');
  if (!datePart || !timePart) {
    return parsed;
  }

  const [year, month, day] = datePart.split('-').map((value) => Number(value));
  const timeSegments = timePart.split(':');
  const hour = Number(timeSegments[0]);
  const minute = Number(timeSegments[1] ?? 0);
  const second = Number((timeSegments[2] ?? '0').split('.')[0]);

  if ([year, month, day, hour, minute, second].some((value) => Number.isNaN(value))) {
    return parsed;
  }

  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
};

export const parseMessageDate = (createdAt?: string) => {
  return buildVietnamDate(createdAt);
};

export const getMessageMillis = (createdAt?: string) => {
  if (!createdAt) return NaN;

  const raw = String(createdAt).trim();
  if (!raw) return NaN;

  const parsed = parseMessageDate(raw);
  if (parsed) {
    return parsed.getTime();
  }

  const epoch = Number(raw);
  if (!Number.isNaN(epoch)) {
    return epoch;
  }

  return NaN;
};

export const isLikelyUrl = (value?: string) => {
  const text = String(value ?? '').trim();
  return /^https?:\/\//i.test(text) || /^file:\/\//i.test(text) || /^content:\/\//i.test(text);
};

export const getDisplayFileNameFromValue = (value?: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }

  try {
    const clean = raw.split('?')[0];
    const decoded = decodeURIComponent(clean);
    const lastPart = decoded.split('/').pop() ?? '';
    const withoutPrefix = lastPart.includes('_') ? lastPart.split('_').slice(1).join('_') : lastPart;
    return withoutPrefix || lastPart || raw;
  } catch {
    const clean = raw.split('?')[0];
    const lastPart = clean.split('/').pop() ?? '';
    return lastPart || raw;
  }
};

export const getReplySnippet = (msg: Message): string => {
  if (msg.isRecalled) return 'Tin nhắn đã được thu hồi';
  const mType = (msg.messageType || 'TEXT').toUpperCase();
  if (mType === 'IMAGE') return '📷 Hình ảnh';
  if (mType === 'IMAGE_GROUP') {
    const imageCount = Array.isArray(msg.attachments) ? msg.attachments.length : 0;
    return imageCount > 0 ? `📷 ${imageCount} hình ảnh` : '📷 Album ảnh';
  }
  if (mType === 'VIDEO') return '🎬 Video';
  if (mType === 'VOICE') return '🎤 Tin nhắn thoại';
  if (mType === 'FILE' || mType === 'MEDIA') {
    const fileName = msg.fileName || getDisplayFileNameFromValue(msg.content);
    return fileName ? `📎 ${fileName}` : '📎 Tệp đính kèm';
  }
  if (mType === 'SHARE_CONTACT') {
    try {
      const c = JSON.parse(msg.content || '{}');
      return `📇 ${c.fullName || 'Danh thiếp'}`;
    } catch {
      return '📇 Danh thiếp';
    }
  }
  let text = msg.content || '';
  try {
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        const extract = (node: any): string => {
          if (!node) return '';
          if (node.type === 'text') return node.text ?? '';
          if (Array.isArray(node.content)) return node.content.map(extract).join('');
          return '';
        };
        text = extract(parsed).trim() || text;
      }
    }
  } catch {
    /* not JSON */
  }
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
};

export const getForwardAttachmentUrls = (msg: Message) => {
  const urls = Array.isArray(msg.attachments)
    ? msg.attachments
        .map((att) => String(att?.url ?? '').trim())
        .filter((url) => url.length > 0)
    : [];

  if (urls.length > 0) {
    return urls;
  }

  const fallback = String(msg.content ?? '').trim();
  return isLikelyUrl(fallback) ? [fallback] : [];
};

export const stripAiMarkdownMarkers = (content: string | null | undefined) => {
  if (!content) return '';

  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*\*/g, '');
};

export const formatMessageTime = (createdAt?: string) => {
  const date = parseMessageDate(createdAt);
  if (!date) return '';

  const { hour, minute } = getVietnamDateParts(date);
  return `${pad2(hour)}:${pad2(minute)}`;
};

export const formatDateSeparator = (createdAt?: string) => {
  const date = parseMessageDate(createdAt);
  if (!date) return null;

  const nowParts = getVietnamDateParts(new Date());
  const dateParts = getVietnamDateParts(date);

  const isToday =
    dateParts.year === nowParts.year &&
    dateParts.month === nowParts.month &&
    dateParts.day === nowParts.day;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayParts = getVietnamDateParts(yesterdayDate);
  const isYesterday =
    dateParts.year === yesterdayParts.year &&
    dateParts.month === yesterdayParts.month &&
    dateParts.day === yesterdayParts.day;

  const time = `${pad2(dateParts.hour)}:${pad2(dateParts.minute)}`;
  const dd = pad2(dateParts.day);
  const mo = pad2(dateParts.month);
  const yyyy = dateParts.year;

  if (isToday) return `${time} Hôm nay`;
  if (isYesterday) return `${time} Hôm qua`;
  return `${time} ${dd}/${mo}/${yyyy}`;
};

export const getFileExtensionFromMimeType = (mimeType?: string) => {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    case 'image/jpg':
    case 'image/jpeg':
    default:
      return 'jpg';
  }
};
