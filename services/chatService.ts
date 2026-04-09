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

    // Vì api.ts đã trả về response.data rồi, nên ta return trực tiếp kết quả này
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
};