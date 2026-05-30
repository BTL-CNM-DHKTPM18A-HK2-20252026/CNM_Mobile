import { chatService } from './chatService';

export const normalizeConversationMembersPayload = (raw: unknown): any[] => {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const payload = raw as Record<string, unknown>;
  const candidates = [payload.members, payload.content, payload.items, payload.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

export const fetchConversationMembers = async (conversationId: string): Promise<any[]> => {
  const response = chatService.unwrapApiPayload<unknown>(
    await chatService.getConversationMembers(conversationId)
  );

  return normalizeConversationMembersPayload(response);
};