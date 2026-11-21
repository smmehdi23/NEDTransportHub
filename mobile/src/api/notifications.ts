import { apiClient } from './client';
import type { MessageResponse, NotificationPage, NotificationRead } from './types';

export const notificationsApi = {
  async list(params?: {
    unread_only?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<NotificationPage> {
    const { data } = await apiClient.get<NotificationPage>('/notifications', { params });
    return data;
  },

  async markAllRead(): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/notifications/read-all');
    return data;
  },

  async markRead(notificationId: number): Promise<NotificationRead> {
    const { data } = await apiClient.post<NotificationRead>(
      `/notifications/${notificationId}/read`,
    );
    return data;
  },

  async registerDevice(token: string, platform: 'android' | 'ios' | 'web'): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>('/notifications/devices', {
      token,
      platform,
    });
    return data;
  },

  async unregisterDevice(token: string): Promise<MessageResponse> {
    const { data } = await apiClient.delete<MessageResponse>('/notifications/devices', {
      params: { token },
    });
    return data;
  },
};
