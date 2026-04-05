import * as SecureStore from 'expo-secure-store';
import api from './api';

export interface AuthenticationResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
  success: boolean;
}

export const authService = {
  login: async (phoneNumber: string, password = 'password123') => {
    try {
      // The backend expects 'username' and 'password'
      const response = await api.post<any, ApiResponse<AuthenticationResponse>>('/auth/login', {
        username: phoneNumber,
        password: password
      });

      if (response.success && response.data.access_token) {
        await SecureStore.setItemAsync('user_token', response.data.access_token);
        return response.data;
      }

      throw new Error(response.message || 'Login failed');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error.response?.data?.message || error.message || 'Network error';
    }
  },

  logout: async () => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (token) {
        await api.post('/auth/logout', { accessToken: token });
      }
    } finally {
      await SecureStore.deleteItemAsync('user_token');
    }
  },

  isAuthenticated: async () => {
    const token = await SecureStore.getItemAsync('user_token');
    return !!token;
  },

  checkPhoneNumber: async (phoneNumber: string) => {
    try {
      console.log(phoneNumber)
      const response = await api.post<any, ApiResponse<boolean>>('/auth/check-phone-number', {
        phoneNumber: phoneNumber
      });
      return response.success && response.data; // Trả về true nếu sđt tồn tại
    } catch (error: any) {
      console.error('Check phone error:', error);
      return false;
    }
  },

  confirmQrLogin: async (uuid: string) => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (!token) throw new Error('You must be logged in to confirm QR');

      // Simple JWT decode to get userId (sub)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      const userId = payload.sub;

      if (!userId) throw new Error('Invalid token: sub missing');

      const response = await api.post<any, ApiResponse<void>>('/auth/qr-confirm', {
        uuid: uuid,
        userId: userId
      });

      return response.success;
    } catch (error: any) {
      console.error('QR Confirm error:', error);
      throw error.response?.data?.message || error.message || 'QR confirmation failed';
    }
  },

  notifyQrScanned: async (uuid: string) => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (!token) return false;

      // Extract userId (sub)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      ));
      const userId = payload.sub;

      await api.post('/auth/qr-scan', {
        uuid: uuid,
        userId: userId
      });
      return true;
    } catch (error: any) {
      console.error('QR Scan Notify error:', error);
      return false;
    }
  },

  register: async (data: {
    phoneNumber: string;
    email: string;
    password: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    dob?: Date;
    gender?: string;
  }) => {
    try {
      const response = await api.post<any, ApiResponse<any>>('/users', data);
      return response;
    } catch (error: any) {
      console.error('Register error:', error);
      throw error.response?.data?.message || error.message || 'Network error';
    }
  },

  getProfile: async () => {
    try {
      const response = await api.get<any, ApiResponse<any>>('/users/me');
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error: any) {
      console.error('Get Profile error:', error);
      return null;
    }
  },

  // 1. Lấy Presigned URL từ Backend
  getAvatarPresignedUrl: async (fileName: string, fileType: string) => {
    const response = await api.get<any, ApiResponse<string>>(
      `/users/me/presigned-url?fileName=${fileName}&fileType=${fileType}`
    );
    return response.data; // Trả về link presigned
  },

  // 2. Upload trực tiếp lên S3 (không qua API Gateway của mình)
  uploadToS3: async (presignedUrl: string, fileUri: string, fileType: string) => {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    return await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': fileType },
    });
  },

  // 3. Cập nhật link avatar vào Database
  updateAvatar: async (avatarUrl: string) => {
    const response = await api.patch<any, ApiResponse<any>>('/users/me/avatar', {
      avatar_url: avatarUrl
    });
    return response.success;
  },

  updateProfile: async (data: {
    displayName: string;
    full_name: string;
    gender: string;
    dob: string;
    bio: string;
    address: string;
    city: string;
    education: string;
    workplace: string;
    lastUpdateProfile: string;
  }) => {
    try {
      const response = await api.patch<any, ApiResponse<any>>('/users/me', data);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 405 || error.response?.status === 500) {
        try {
          const fallback = await api.post<any, ApiResponse<any>>('/users/me', data);
          if (fallback.success && fallback.data) {
            return fallback.data;
          }
          return null;
        } catch (fallbackError: any) {
          console.error('Update Profile fallback error:', fallbackError);
          throw fallbackError.response?.data?.message || fallbackError.message || 'Network error';
        }
      }

      console.error('Update Profile error:', error);
      throw error.response?.data?.message || error.message || 'Network error';
    }
  }
};

// Simple atob polyfill for React Native if not available
const atob = (input: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 === 1) throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");

  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))) : 0) {
    buffer = chars.indexOf(buffer);
  }

  return output;
};
