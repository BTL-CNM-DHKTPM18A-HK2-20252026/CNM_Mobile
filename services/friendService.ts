import api from './api';

export interface FriendRequestRequest {
  userId: string;
  message?: string;
}

export interface UserResponse {
  user_id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  friendship_status?: string;
  [key: string]: any; // Cho các trường bổ sung khác
}

export const friendService = {
  /**
   * Lấy danh sách bạn bè
   */
  getFriendsList: async () => {
    return await api.get('/friends');
  },

  /**
   * Gửi lời mời kết bạn
   */
  sendRequest: async (userId: string, message?: string) => {
    return await api.post('/friends/request', { userId, message });
  },

  /**
   * Chấp nhận lời mời kết bạn
   */
  acceptRequest: async (requestId: string) => {
    return await api.put(`/friends/request/${requestId}/accept`, {});
  },

  /**
   * Lấy danh sách lời mời đã nhận
   */
  getReceivedRequests: async () => {
    return await api.get('/friends/requests/received');
  },

  getSentRequests: async () => {
    return await api.get('/friends/requests/sent');
  },

  /**
   * Chấp nhận lời mời kết bạn nhận được từ senderId
   */
  acceptRequestBySender: async (senderId: string) => {
    const res: any = await api.get('/friends/requests/received');
    if (!res.success || !Array.isArray(res.data)) {
      throw new Error('Không thể lấy danh sách lời mời.');
    }

    const request = res.data.find((requestItem: any) => requestItem.senderId === senderId);
    if (!request) {
      throw new Error('Không tìm thấy lời mời từ người dùng này.');
    }

    return await api.put(`/friends/request/${request.requestId}/accept`, {});
  },

  /**
   * Từ chối lời mời kết bạn
   */
  rejectRequest: async (requestId: string) => {
    return await api.put(`/friends/request/${requestId}/reject`, {});
  },

  /**
   * Hủy kết bạn hoặc hủy lời mời đã gửi
   */
  unfriend: async (userId: string) => {
    return await api.delete('/friends/unfriend', { data: { userId } });
  }
};