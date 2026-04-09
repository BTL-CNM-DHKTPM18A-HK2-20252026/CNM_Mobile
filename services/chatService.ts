import api from './api';

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

  createDirectConversation: async (targetUserId: string) => {
    return await api.post('/conversations', {
      type: 'DIRECT',
      participantIds: [targetUserId],
    });
  },

  getMessages: async (conversationId: string, page = 0, size = 50) => {
    return await api.get(`/messages/conversation/${conversationId}?page=${page}&size=${size}`);
  },

  sendMessage: async (
    conversationId: string,
    payload: {
      content: string;
      messageType?: string;
      attachments?: unknown[];
    }
  ) => {
    const timestamp = new Date().toISOString();
    const endpoint = '/messages';
    const body = {
      conversationId,
      content: payload.content,
      messageType: payload.messageType ?? 'TEXT',
    };

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
};