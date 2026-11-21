import { apiClient } from './client';
import type { MessageResponse, PollCreate, PollPage, PollRead, RideMatchRead } from './types';

export const pollsApi = {
  async createPoll(payload: PollCreate): Promise<PollRead> {
    const { data } = await apiClient.post<PollRead>('/polls', payload);
    return data;
  },

  async listPolls(params?: {
    origin?: string;
    destination?: string;
    mine?: boolean;
    sort?: 'votes' | 'time' | 'new';
    page?: number;
    page_size?: number;
  }): Promise<PollPage> {
    const { data } = await apiClient.get<PollPage>('/polls', { params });
    return data;
  },

  async getPoll(pollId: number): Promise<PollRead> {
    const { data } = await apiClient.get<PollRead>(`/polls/${pollId}`);
    return data;
  },

  async vote(pollId: number): Promise<PollRead> {
    const { data } = await apiClient.post<PollRead>(`/polls/${pollId}/vote`);
    return data;
  },

  async removeVote(pollId: number): Promise<PollRead> {
    const { data } = await apiClient.delete<PollRead>(`/polls/${pollId}/vote`);
    return data;
  },

  async closePoll(pollId: number): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>(`/polls/${pollId}/close`);
    return data;
  },

  async getMatches(pollId: number): Promise<RideMatchRead[]> {
    const { data } = await apiClient.get<RideMatchRead[]>(`/polls/${pollId}/matches`);
    return data;
  },
};
