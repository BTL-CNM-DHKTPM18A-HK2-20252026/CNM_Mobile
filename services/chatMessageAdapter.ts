export interface ChatUiMessage {
  messageId: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
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

const getSenderName = (payload: ChatPayload) => {
  const directSenderName = toStringOrEmpty(payload.senderName);
  if (directSenderName) {
    return directSenderName;
  }

  const sender = payload.sender as ChatPayload | undefined;
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
  const content = toStringOrEmpty(payload.content ?? payload.message);

  if (!senderId || !content) {
    return null;
  }

  const createdAt = normalizeDate(payload.createdAt ?? payload.timestamp ?? payload.sentAt);

  return {
    messageId,
    content,
    senderId,
    createdAt,
    senderName: getSenderName(payload),
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
