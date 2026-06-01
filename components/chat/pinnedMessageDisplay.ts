import { extractRichTextPlainText } from './RichTextRenderer';

export const MAX_PINNED_MESSAGES = 5;

export type PinnedMessageLike = {
  content?: string | null;
  contentUrl?: string | null;
  fileName?: string | null;
  messageType?: string | null;
  thumbnailUrl?: string | null;
  attachments?: Array<{
    url?: string | null;
    thumbnailUrl?: string | null;
    fileName?: string | null;
  }>;
};

const looksLikeJsonPayload = (value: string) => {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
};

const isLikelyUrl = (value?: string) => {
  const text = String(value ?? '').trim();
  return /^https?:\/\//i.test(text) || /^file:\/\//i.test(text) || /^content:\/\//i.test(text);
};

const getDisplayFileNameFromValue = (value?: string) => {
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

const getPinnedPlainText = (item: PinnedMessageLike) => {
  const rawContent = String(item?.content ?? '').trim();
  if (!rawContent) {
    return '';
  }

  const plainText = extractRichTextPlainText(rawContent).trim();
  if (!plainText) {
    return '';
  }

  if (looksLikeJsonPayload(rawContent) && plainText === rawContent) {
    return '';
  }

  return plainText;
};

export const getPinnedMessagePreviewText = (item: PinnedMessageLike) => {
  const pinnedType = String(item?.messageType ?? '').toUpperCase();

  if (pinnedType === 'IMAGE' || pinnedType === 'IMAGE_GROUP') {
    return '[Hình ảnh]';
  }

  if (pinnedType === 'VIDEO') {
    return '[Video]';
  }

  if (pinnedType === 'FILE' || pinnedType === 'MEDIA') {
    const fileName = String(item?.fileName ?? '').trim() || getDisplayFileNameFromValue(item?.contentUrl || item?.content || undefined);
    return fileName ? `[File] ${fileName}` : '[File]';
  }

  if (pinnedType === 'LINK') {
    return '[Link]';
  }

  const plainText = getPinnedPlainText(item);
  if (plainText) {
    if (isLikelyUrl(plainText) && !/\s/.test(plainText)) {
      return '[Link]';
    }

    return plainText;
  }

  const candidateUrl = String(item?.contentUrl ?? item?.content ?? '').trim();
  if (isLikelyUrl(candidateUrl)) {
    return '[Link]';
  }

  return '[Tin nhắn]';
};

export const getPinnedMessageThumbnailUrl = (item: PinnedMessageLike) => {
  const pinnedType = String(item?.messageType ?? '').toUpperCase();

  if (pinnedType === 'IMAGE') {
    const candidate = String(item?.contentUrl ?? item?.content ?? '').trim();
    return isLikelyUrl(candidate) ? candidate : '';
  }

  if (pinnedType === 'IMAGE_GROUP') {
    const firstAttachment = item?.attachments?.[0]?.url;
    const candidate = String(firstAttachment || item?.contentUrl || item?.content || '').trim();
    return isLikelyUrl(candidate) ? candidate : '';
  }

  return '';
};
