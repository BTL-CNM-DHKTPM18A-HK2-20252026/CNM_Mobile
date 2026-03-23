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
  }
};
