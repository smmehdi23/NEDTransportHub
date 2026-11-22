import { apiClient } from './client';
import type { MessageResponse, TokenResponse } from './types';

export const authApi = {
  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    department?: string;
  }): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/auth/register', payload);
    return data;
  },

  async verifyEmail(payload: { email: string; otp: string }): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/auth/verify-email', payload);
    return data;
  },

  async resendVerification(email: string): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/auth/resend-verification', { email });
    return data;
  },

  async login(payload: { email: string; password: string }): Promise<TokenResponse> {
    const { data } = await apiClient.post<TokenResponse>('/auth/login', payload);
    return data;
  },

  async logout(refreshToken?: string | null): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/auth/logout', {
      refresh_token: refreshToken ?? undefined,
    });
    return data;
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/auth/forgot-password', { email });
    return data;
  },

  async resetPassword(payload: {
    email: string;
    otp: string;
    new_password: string;
  }): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/auth/reset-password', payload);
    return data;
  },
};
