import { apiClient } from './client';
import type { PendingRatingPerson, RatingRead, RatingSummary } from './types';

export const ratingsApi = {
  async submitRating(payload: {
    ride_id: number;
    rated_user_id: number;
    score: number;
    review?: string;
  }): Promise<RatingRead> {
    const { data } = await apiClient.post<RatingRead>('/ratings', payload);
    return data;
  },

  async getPendingRatings(rideId: number): Promise<PendingRatingPerson[]> {
    const { data } = await apiClient.get<PendingRatingPerson[]>(`/ratings/rides/${rideId}/pending`);
    return data;
  },

  async getUserSummary(userId: number): Promise<RatingSummary> {
    const { data } = await apiClient.get<RatingSummary>(`/ratings/users/${userId}`);
    return data;
  },
};
