import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api from './api';

const storage = {
  setItemAsync: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItemAsync: async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key) || null;
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  deleteItemAsync: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export interface AuthenticationResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
  success: boolean;
}

const decodeUserIdFromToken = async (token: string) => {
  try {
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

    if (userId) {
      await storage.setItemAsync('user_id', String(userId));
      return String(userId);
    }
  } catch (decodeError) {
    console.error('[AUTH] Failed to decode user_id from token:', decodeError);
  }

  return null;
};

export const authService = {
  login: async (username: string, password: string) => {
    try {
      console.log('[LOGIN] URL:', api.defaults.baseURL + '/auth/login');
      console.log('[LOGIN] Body:', { username, password });
      
      const response = await api.post<any, ApiResponse<AuthenticationResponse>>('/auth/login', {
        username,
        password
      });
      console.log('[LOGIN] Response:', response);

      if (response.success && response.data.access_token) {
        const token = response.data.access_token;
        await storage.setItemAsync('user_token', token);
        
        // Save refresh token for silent token renewal
        if (response.data.refresh_token) {
          await storage.setItemAsync('refresh_token', response.data.refresh_token);
        }
        
        await decodeUserIdFromToken(token);
        
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
      const token = await storage.getItemAsync('user_token');
      if (token) {
        await api.post('/auth/logout', { accessToken: token });
      }
    } finally {
      await storage.deleteItemAsync('user_token');
      await storage.deleteItemAsync('refresh_token');
      await storage.deleteItemAsync('user_id');
    }
  },

  isAuthenticated: async () => {
    const token = await storage.getItemAsync('user_token');
    return !!token;
  },

  checkEmail: async (email: string) => {
    try {
      const response = await api.post<any, ApiResponse<boolean>>('/auth/check-email', {
        email
      });

      return Boolean(response.success && response.data);
    } catch (error: any) {
      console.error('Check email error:', error);
      throw error.response?.data?.message || error.message || 'Network error';
    }
  },

  checkPhone: async (phoneNumber: string) => {
    try {
      const response = await api.post<any, ApiResponse<boolean>>('/auth/check-phone', {
        phoneNumber,
      });

      return Boolean(response.success && response.data);
    } catch (error: any) {
      console.error('Check phone error:', error);
      throw error.response?.data?.message || error.message || 'Network error';
    }
  },

  confirmQrLogin: async (uuid: string) => {
    try {
      const token = await storage.getItemAsync('user_token');
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
      const token = await storage.getItemAsync('user_token');
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
    email?: string;
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

  verifyOtp: async (email: string, otp: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/verify-otp', {
        email,
        otp,
      });
      return response.success;
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      throw error.response?.data?.message || error.message || 'OTP verification failed';
    }
  },

  resendOtp: async (email: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/resend-otp', {
        email,
      });
      return response.success;
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      throw error.response?.data?.message || error.message || 'Resend OTP failed';
    }
  },

  sendRegisterOtp: async (email: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/register/send-otp', {
        email,
      });
      return response.success;
    } catch (error: any) {
      console.error('Send register OTP error:', error);
      throw error.response?.data?.message || error.message || 'Send register OTP failed';
    }
  },

  verifyRegisterOtp: async (email: string, otp: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/register/verify-otp', {
        email,
        otp,
      });
      return response.success;
    } catch (error: any) {
      console.error('Verify register OTP error:', error);
      throw error.response?.data?.message || error.message || 'Verify register OTP failed';
    }
  },

  resendRegisterOtp: async (email: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/register/send-otp', {
        email,
      });
      return response.success;
    } catch (error: any) {
      console.error('Resend register OTP error:', error);
      throw error.response?.data?.message || error.message || 'Resend register OTP failed';
    }
  },

  verifyEmailOtp: async (email: string, otp: string) => {
    return authService.verifyOtp(email, otp);
  },

  resendEmailOtp: async (email: string) => {
    return authService.resendOtp(email);
  },

  sendPasswordResetOtp: async (email: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/forgot-password/send-otp', {
        email,
      });
      return response.success;
    } catch (error: any) {
      console.error('Send password reset OTP error:', error);
      throw error.response?.data?.message || error.message || 'Send password reset OTP failed';
    }
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    try {
      const response = await api.post<any, ApiResponse<void>>('/auth/forgot-password/reset', {
        email,
        otp,
        newPassword,
      });
      return response.success;
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw error.response?.data?.message || error.message || 'Reset password failed';
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
