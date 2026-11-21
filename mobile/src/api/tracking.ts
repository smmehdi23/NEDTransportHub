import { apiClient } from './client';
import { getWsUrl } from '../config/env';
import type { MessageResponse, TrackingSnapshot } from './types';

export const trackingApi = {
  async getRideTracking(rideId: number): Promise<TrackingSnapshot> {
    const { data } = await apiClient.get<TrackingSnapshot>(`/tracking/rides/${rideId}`);
    return data;
  },

  async pushLocation(
    rideId: number,
    payload: { lat: number; lng: number; speed_kmh?: number | null },
  ): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>(
      `/tracking/rides/${rideId}/location`,
      payload,
    );
    return data;
  },

  getWebSocketUrl(rideId: number, accessToken: string): string {
    return `${getWsUrl(`/tracking/ws/${rideId}`)}?token=${encodeURIComponent(accessToken)}`;
  },
};
