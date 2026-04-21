import api from './api';

export interface UserStatus {
  userId: string;
  online: boolean;
  lastSeen: string | null;
}

export const presenceService = {
  getInitialFriendsStatus: async (): Promise<UserStatus[]> => {
    try {
      const response = await api.get('/presence/friends');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('[PresenceService] Fetch friends status error:', error);
      return [];
    }
  },

  getUserStatus: async (userId: string): Promise<UserStatus | null> => {
    try {
      const response = await api.get(`/presence/${userId}`);
      return response.data || null;
    } catch (error) {
      console.error('[PresenceService] Fetch user status error:', error);
      return null;
    }
  }
};