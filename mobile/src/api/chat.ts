import { apiClient } from './client';
import { getWsUrl } from '../config/env';
import type { MessageRead } from './types';

export const chatApi = {
  async getMessages(bookingId: number, params?: { before_id?: number; limit?: number }): Promise<MessageRead[]> {
    const { data } = await apiClient.get<MessageRead[]>(`/chat/${bookingId}/messages`, { params });
    return data;
  },

  async sendMessage(bookingId: number, content: string): Promise<MessageRead> {
    const { data } = await apiClient.post<MessageRead>(`/chat/${bookingId}/messages`, { content });
    return data;
  },

  getWebSocketUrl(bookingId: number, accessToken: string): string {
    return `${getWsUrl(`/ws/chat/${bookingId}`)}?token=${encodeURIComponent(accessToken)}`;
  },
};
