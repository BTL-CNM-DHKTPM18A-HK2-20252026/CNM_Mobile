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

  return Array.from(counter.entries()).map(([emoji, count]) => ({ emoji, count }));
};

export const pad2 = (value: number) => String(value).padStart(2, '0');

export const toLocalIsoString = (date: Date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

export const parseMessageDate = (createdAt?: string) => {
  if (!createdAt) return null;
  let raw = String(createdAt).trim();
  if (!raw) return null;

  // QUAN TRỌNG: Cắt bỏ đuôi múi giờ (Z, +00:00, +07:00)
  // Để ép Javascript hiểu chuỗi này là giờ địa phương thiết bị
  raw = raw.replace(/(Z|[+-]\d{2}:?\d{2})$/i, '');

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const epoch = Number(raw);
  if (!Number.isNaN(epoch)) {
    const fallback = new Date(epoch);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }

  return null;
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
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

export const formatDateSeparator = (createdAt?: string) => {
  const date = parseMessageDate(createdAt);
  if (!date) return null;

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();

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
