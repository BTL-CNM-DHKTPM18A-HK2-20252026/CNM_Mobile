export interface ChatUiMessage {
  messageId: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
  senderAvatarUrl?: string;
  messageType?: string;
  isEdited?: boolean;
  isRecalled?: boolean;
  reactions?: ChatUiReaction[];
  fileName?: string;
  fileSize?: number;
  caption?: string;
  videoDuration?: number;
  voiceDuration?: number;
  // Reply
  replyToMessageId?: string;
  replyToSenderName?: string;
  replyToContent?: string;
  replyToMessageType?: string;
  // Forward
  forwardedFromSenderName?: string;
  // IMAGE_GROUP attachments
  attachments?: { url: string; fileName?: string; fileSize?: number; thumbnailUrl?: string }[];
}

export interface ChatUiReaction {
  id: string;
  userId: string;
  emoji: string;
  reactionType: string;
}

type ChatPayload = Record<string, unknown>;

const toStringOrEmpty = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return '';
  }

  return String(value);
};

const normalizeDate = (value: unknown) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return new Date().toISOString();
};

const toBoolean = (value: unknown) => value === true;

const mapReactionTypeToEmoji = (reactionType?: string) => {
  switch ((reactionType || '').toUpperCase()) {
    case 'LOVE':
      return '❤️';
    case 'HAHA':
      return '😂';
    case 'WOW':
      return '😲';
    case 'SAD':
      return '😭';
    case 'ANGRY':
      return '😡';
    default:
      return '👍';
  }
};

const mapReactions = (value: unknown): ChatUiReaction[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }

      const reaction = raw as ChatPayload;
      const reactionType = toStringOrEmpty(reaction.reactionType ?? reaction.icon).toUpperCase() || 'LIKE';

      return {
        id: toStringOrEmpty(reaction.id ?? reaction.reactionId) || `reaction-${index}`,
        userId: toStringOrEmpty(reaction.userId),
        emoji: mapReactionTypeToEmoji(reactionType),
        reactionType,
      };
    })
    .filter((reaction): reaction is ChatUiReaction => Boolean(reaction));
};

const getSenderName = (payload: ChatPayload) => {
  const directSenderName = toStringOrEmpty(payload.senderName);
  if (directSenderName) {
    return directSenderName;
  }

  const altDirectName = toStringOrEmpty(
    payload.senderDisplayName ?? payload.displayName ?? payload.fullName
  );
  if (altDirectName) {
    return altDirectName;
  }

  const sender = payload.sender as ChatPayload | undefined;
  const displayName = sender ? toStringOrEmpty(sender.displayName ?? sender.display_name) : '';
  if (displayName) {
    return displayName;
  }

  const fullName = sender ? toStringOrEmpty(sender.fullName ?? sender.full_name) : '';
  if (fullName) {
    return fullName;
  }

  const username = sender ? toStringOrEmpty(sender.username) : '';
  if (username) {
    return username;
  }

  const name = sender ? toStringOrEmpty(sender.name) : '';
  if (name) {
    return name;
  }

  return 'Unknown';
};

export const mapChatPayloadToUiMessage = (input: unknown): ChatUiMessage | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  let payload = input as ChatPayload;

  // Handle nested message response from /messages POST endpoint
  if (payload.message && typeof payload.message === 'object' && !payload.messageId) {
    payload = payload.message as ChatPayload;
  }

  const sender = payload.sender as ChatPayload | undefined;

  const rawMessageId = payload.messageId ?? payload.id;
  const rawSenderId = payload.senderId ?? sender?.id ?? payload.userId;

  const messageId = toStringOrEmpty(rawMessageId) || `tmp-${Date.now()}`;
  const senderId = toStringOrEmpty(rawSenderId);
  let content = toStringOrEmpty(payload.content ?? payload.message);
  const messageType = toStringOrEmpty(payload.messageType ?? payload.type ?? 'TEXT').toUpperCase();
  const isRecalled = toBoolean(payload.isRecalled);
  const isEdited = toBoolean(payload.isEdited);

  const MEDIA_TYPES = ['IMAGE', 'IMAGE_GROUP', 'VIDEO', 'FILE', 'MEDIA', 'VOICE', 'STICKER', 'SHARE_CONTACT', 'LINK'];
  const hasMedia = MEDIA_TYPES.includes(messageType)
    || (Array.isArray(payload.attachments) && (payload.attachments as unknown[]).length > 0)
    || Boolean(payload.fileName);

  // Fallback to s3Url or fileUrl for media types where content is empty
  if (hasMedia && !content) {
    content = toStringOrEmpty(payload.s3Url ?? payload.fileUrl ?? payload.mediaUrl);
  }

  if (!senderId || (!content && !isRecalled && !hasMedia)) {
    return null;
  }

  const createdAt = normalizeDate(payload.createdAt ?? payload.timestamp ?? payload.sentAt);
  const senderAvatarUrl =
    toStringOrEmpty(payload.senderAvatarUrl ?? payload.sender_avatar_url) ||
    toStringOrEmpty(sender?.avatarUrl ?? sender?.avatar_url ?? sender?.avatar);

  return {
    messageId,
    content,
    senderId,
    createdAt,
    senderName: getSenderName(payload),
    senderAvatarUrl: senderAvatarUrl || undefined,
    messageType,
    isEdited,
    isRecalled,
    reactions: mapReactions(payload.reactions),
    fileName: toStringOrEmpty(payload.fileName) || undefined,
    fileSize: typeof payload.fileSize === 'number' ? payload.fileSize : undefined,
    caption: toStringOrEmpty(payload.caption) || undefined,
    videoDuration: typeof payload.videoDuration === 'number' ? payload.videoDuration : undefined,
    voiceDuration: typeof payload.voiceDuration === 'number' ? payload.voiceDuration : undefined,
    replyToMessageId: toStringOrEmpty(payload.replyToMessageId) || undefined,
    replyToSenderName: toStringOrEmpty(payload.replyToSenderName) || undefined,
    replyToContent: toStringOrEmpty(payload.replyToContent) || undefined,
    replyToMessageType: toStringOrEmpty(payload.replyToMessageType) || undefined,
    forwardedFromSenderName: toStringOrEmpty(payload.forwardedFromSenderName) || undefined,
    attachments: Array.isArray(payload.attachments)
      ? (payload.attachments as Array<Record<string, unknown>>).map((att) => ({
          url: toStringOrEmpty(att.url ?? att.content ?? att.mediaUrl ?? att.fileUrl),
          fileName: toStringOrEmpty(att.fileName) || undefined,
          fileSize: typeof att.fileSize === 'number' ? att.fileSize : undefined,
          thumbnailUrl: toStringOrEmpty(att.thumbnailUrl) || undefined,
        })).filter((att) => att.url)
      : Array.isArray(payload.mediaUrls)
        ? (payload.mediaUrls as string[]).map((url) => ({ url })).filter((att) => att.url)
        : undefined,
  };
};

export const mapChatPayloadListToUiMessages = (input: unknown): ChatUiMessage[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(mapChatPayloadToUiMessage)
    .filter((message): message is ChatUiMessage => Boolean(message));
};
