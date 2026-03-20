import api from './api';
import * as SecureStore from 'expo-secure-store';

export interface AuthenticationResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
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

      if (response.success && response.result.accessToken) {
        await SecureStore.setItemAsync('user_token', response.result.accessToken);
        return response.result;
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
  }
};
