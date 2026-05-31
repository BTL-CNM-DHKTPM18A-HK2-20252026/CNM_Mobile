import type { ChatUiReaction } from '../services/chatMessageAdapter';

export interface Message {
  messageId: string;
  content: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
  senderAvatarUrl?: string;
  messageType?: string;
  systemActionType?: 'PIN' | 'UNPIN' | 'JOIN' | 'LEAVE' | 'INFO';
  systemTargetMessageId?: string;
  systemActorName?: string;
  isEdited?: boolean;
  isRecalled?: boolean;
  updatedAt?: string;
  reactions?: ChatUiReaction[];
  fileName?: string;
  fileSize?: number;
  caption?: string;
  thumbnailUrl?: string;
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

export interface PinnedMessageItem {
  id: string;
  messageId: string;
  content: string;
  messageType?: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  caption?: string;
  attachments?: { url: string; fileName?: string; fileSize?: number; thumbnailUrl?: string }[];
  senderName?: string;
  pinnedAt?: string;
}

export interface ForwardConversationItem {
  id: string;
  name: string;
  avatarUrl?: string;
  type?: 'AI' | 'CLOUD' | 'GROUP' | 'PRIVATE' | 'OTHER';
}

export interface MessagePageResponse {
  content?: unknown[];
  last?: boolean;
  totalPages?: number;
  number?: number;
}

export interface ApiWrappedPayload<T> {
  success?: boolean;
  data?: T;
}

export type ReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';
