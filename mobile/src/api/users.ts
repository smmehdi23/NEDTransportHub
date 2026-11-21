import { apiClient } from './client';
import type { UserRead, UserUpdate } from './types';

export const usersApi = {
  async getMe(): Promise<UserRead> {
    const { data } = await apiClient.get<UserRead>('/users/me');
    return data;
  },

  async updateMe(payload: UserUpdate): Promise<UserRead> {
    const { data } = await apiClient.patch<UserRead>('/users/me', payload);
    return data;
  },
};
