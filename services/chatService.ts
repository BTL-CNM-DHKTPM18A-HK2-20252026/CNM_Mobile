import api from './api';

const unwrapApiPayload = <T>(raw: any): T => {
  if (raw && typeof raw === 'object' && raw.success && raw.data !== undefined) {
    return raw.data as T;
  }

  return raw as T;
};

const extractConversationId = (raw: any): string | null => {
  const payload = unwrapApiPayload<any>(raw);
  const id = payload?.conversationId ?? payload?.conversation_id ?? payload?.id ?? null;
  return id ? String(id) : null;
};

export const chatService = {
  getConversations: async (page = 0, size = 20, search?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });

    if (search?.trim()) {
      params.append('search', search.trim());
    }

    return await api.get(`/conversations?${params.toString()}`);
  },

  ensureSelfConversation: async () => {
    return await api.get('/conversations/self');
  },

  ensureSelfConversationId: async (): Promise<string | null> => {
    const response = await api.get('/conversations/self');
    return extractConversationId(response);
  },

  ensureAiConversation: async () => {
    return await api.get('/messages/ai/conversation');
  },

  ensureAiConversationId: async (): Promise<string | null> => {
    const response = await api.get('/messages/ai/conversation');
    return extractConversationId(response);
  },

  createDirectConversation: async (targetUserId: string) => {
    return await api.post('/conversations', {
      type: 'DIRECT',
      participantIds: [targetUserId],
    });
  },

  /**
   * Lấy hoặc tạo cuộc trò chuyện riêng với 1 người bạn.
   * Backend sẽ tự tạo nếu chưa có.
   */
  getPrivateConversation: async (friendId: string) => {
    return await api.get(`/conversations/private/${friendId}`);
  },

  getMessages: async (conversationId: string, page = 0, size = 10, sort = 'createdAt,desc') => {
    return await api.get(`/messages/conversation/${conversationId}?page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`);
  },

  getMessagesBefore: async (conversationId: string, beforeId: string, size = 10) => {
    const params = new URLSearchParams({
      beforeId,
      size: String(size),
    });

    return await api.get(`/messages/conversation/${conversationId}?${params.toString()}`);
  },

  sendMessage: async (
    conversationId: string,
    payload: {
      content: string;
      messageType?: string;
      attachments?: unknown[];
      fileName?: string;
      fileSize?: number;
      caption?: string;
      videoDuration?: number;
      voiceDuration?: number;
      replyToMessageId?: string;
      forwardedFromMessageId?: string;
      mediaUrls?: string[];
    }
  ) => {
    const timestamp = new Date().toISOString();
    const endpoint = '/messages';
    const body: Record<string, unknown> = {
      conversationId,
      content: payload.content,
      messageType: payload.messageType ?? 'TEXT',
    };

    if (payload.fileName) body.fileName = payload.fileName;
    if (payload.fileSize) body.fileSize = payload.fileSize;
    if (payload.caption) body.caption = payload.caption;
    if (payload.videoDuration) body.videoDuration = payload.videoDuration;
    if (payload.voiceDuration) body.voiceDuration = payload.voiceDuration;
    if (payload.replyToMessageId) body.replyToMessageId = payload.replyToMessageId;
    if (payload.forwardedFromMessageId) body.forwardedFromMessageId = payload.forwardedFromMessageId;
    if (payload.mediaUrls && payload.mediaUrls.length > 0) body.mediaUrls = payload.mediaUrls;

    console.log('[SEND_MESSAGE]', {
      timestamp,
      endpoint,
      conversationId,
      contentLength: payload.content.length,
      messageType: payload.messageType ?? 'TEXT',
    });

    try {
      const response = await api.post(endpoint, body);
      console.log('[SEND_MESSAGE_SUCCESS]', { timestamp, endpoint, messageId: response?.id });
      return response;
    } catch (error) {
      console.error('[SEND_MESSAGE_ERROR]', {
        timestamp,
        endpoint,
        error: (error as any)?.message,
      });
      throw error;
    }
  },

  sendAiMessage: async (
    payload: {
      content: string;
      conversationId?: string;
      useRag?: boolean;
      language?: 'vi' | 'en';
      fullAccessGranted?: boolean;
      themeType?: string;
    }
  ) => {
    const body: Record<string, unknown> = {
      content: payload.content,
      useRag: payload.useRag ?? true,
      language: payload.language ?? 'vi',
      fullAccessGranted: payload.fullAccessGranted ?? false,
      themeType: payload.themeType ?? 'general',
    };

    if (payload.conversationId) {
      body.conversationId = payload.conversationId;
    }

    return await api.post('/messages/ai', body);
  },

  reactToMessage: async (messageId: string, reactionType: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY') => {
    return await api.post(`/messages/${messageId}/react`, { reactionType });
  },

  updateMessage: async (messageId: string, content: string) => {
    return await api.put(`/messages/${messageId}?content=${encodeURIComponent(content)}`, {});
  },

  recallMessage: async (messageId: string) => {
    return await api.post(`/messages/${messageId}/recall`, {});
  },

  deleteMessageLocal: async (messageId: string) => {
    return await api.delete(`/messages/${messageId}/local`);
  },

  pinMessage: async (messageId: string) => {
    return await api.post(`/messages/${messageId}/pin`, {});
  },

  unpinMessage: async (messageId: string) => {
    return await api.delete(`/messages/${messageId}/pin`);
  },

  getPinnedMessages: async (conversationId: string) => {
    return await api.get(`/messages/conversations/${conversationId}/pinned`);
  },

  getConversationMembers: async (conversationId: string) => {
    return await api.get(`/conversations/${conversationId}/members`);
  },

  addConversationMembers: async (conversationId: string, memberIds: string[]) => {
    return await api.post(`/conversations/${conversationId}/members`, memberIds);
  },

  removeConversationMember: async (conversationId: string, memberId: string) => {
    return await api.delete(`/conversations/${conversationId}/members/${memberId}`);
  },

  changeMemberRole: async (conversationId: string, memberId: string, role: 'DEPUTY' | 'MEMBER') => {
    return await api.patch(`/conversations/${conversationId}/members/${memberId}/role`, { role });
  },

  leaveConversation: async (conversationId: string, successorId?: string) => {
    const body = successorId ? { successorId } : {};
    return await api.post(`/conversations/${conversationId}/leave`, body);
  },

  dissolveConversation: async (conversationId: string) => {
    return await api.delete(`/conversations/${conversationId}/dissolve`);
  },

  transferOwnership: async (conversationId: string, newAdminId: string) => {
    return await api.post(`/conversations/${conversationId}/transfer`, { newAdminId });
  },

  getConversationMedia: async (conversationId: string) => {
    return await api.get(`/messages/conversation/${conversationId}/media`);
  },

  getStorageStats: async () => {
    return await api.get('/storage/me');
  },

  clearConversation: async (conversationId: string) => {
    return await api.delete(`/messages/conversations/${conversationId}/all`);
  },

  unwrapApiPayload,
};