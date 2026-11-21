import { apiClient } from './client';
import type { MessageResponse, RideCreate, RideMatchRead, RidePage, RideRead } from './types';

export const ridesApi = {
  async createRide(payload: RideCreate): Promise<RideRead> {
    const { data } = await apiClient.post<RideRead>('/rides', payload);
    return data;
  },

  async searchRides(params: {
    pickup_lat: number;
    pickup_lng: number;
    dropoff_lat?: number;
    dropoff_lng?: number;
    departure_time?: string;
    window_minutes?: number;
    radius_m?: number;
    max_fare?: number;
    min_seats?: number;
    sort?: 'best' | 'time' | 'fare';
  }): Promise<RideMatchRead[]> {
    const { data } = await apiClient.get<RideMatchRead[]>('/rides/search', { params });
    return data;
  },

  async browseRides(params?: {
    origin?: string;
    destination?: string;
    date?: string;
    mine?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<RidePage> {
    const { data } = await apiClient.get<RidePage>('/rides', { params });
    return data;
  },

  async getRide(rideId: number): Promise<RideRead> {
    const { data } = await apiClient.get<RideRead>(`/rides/${rideId}`);
    return data;
  },

  async updateRide(
    rideId: number,
    payload: {
      departure_time?: string;
      estimated_fare?: number;
      total_seats?: number;
      notes?: string;
    },
  ): Promise<RideRead> {
    const { data } = await apiClient.patch<RideRead>(`/rides/${rideId}`, payload);
    return data;
  },

  async cancelRide(rideId: number, reason?: string): Promise<MessageResponse> {
    const { data } = await apiClient.post<MessageResponse>(`/rides/${rideId}/cancel`, { reason });
    return data;
  },

  async startRide(rideId: number): Promise<RideRead> {
    const { data } = await apiClient.post<RideRead>(`/rides/${rideId}/start`);
    return data;
  },

  async completeRide(rideId: number): Promise<RideRead> {
    const { data } = await apiClient.post<RideRead>(`/rides/${rideId}/complete`);
    return data;
  },
};
