import { apiClient } from './client';
import type { HistoryItem } from './types';

export const historyApi = {
  async getMyHistory(params?: {
    bucket?: 'upcoming' | 'completed' | 'cancelled' | 'all';
    role?: 'driver' | 'passenger' | 'all';
    limit?: number;
  }): Promise<HistoryItem[]> {
    const { data } = await apiClient.get<HistoryItem[]>('/history', { params });
    return data;
  },
};
