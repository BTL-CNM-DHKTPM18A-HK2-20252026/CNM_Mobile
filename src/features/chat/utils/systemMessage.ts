import type { ChatUiMessage } from '@/services/chatMessageAdapter';

export const isSystemMessage = (message?: Pick<ChatUiMessage, 'messageType'> | null): boolean => {
  return String(message?.messageType ?? '').toUpperCase() === 'SYSTEM';
};

export const getSystemMessageContent = (message?: Pick<ChatUiMessage, 'content'> | null): string => {
  return String(message?.content ?? '').trim();
};