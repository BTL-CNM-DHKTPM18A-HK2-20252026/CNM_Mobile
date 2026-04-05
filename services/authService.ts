import api from './api';
import * as SecureStore from 'expo-secure-store';

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
      console.log('[LOGIN] URL:', api.defaults.baseURL + '/auth/login');
      console.log('[LOGIN] Body:', { username: phoneNumber, password });
      // The backend expects 'username' and 'password'
      const response = await api.post<any, ApiResponse<AuthenticationResponse>>('/auth/login', {
        username: phoneNumber,
        password: password
      });
      console.log('[LOGIN] Response:', response);



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
      console.log(api);
      const response = await api.post<any, ApiResponse<boolean>>('/auth/check-phone-number', {
        phoneNumber: phoneNumber
      });

      console.log(response)
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

  verifyEmailOtp: async (email: string, otp: string) => {
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

  resendEmailOtp: async (email: string) => {
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
