import { apiClient } from './client';
import type { CampusGatesResponse, FareEstimate, GeocodeResult, RoutePreview } from './types';

export const mapsApi = {
  async getRoutePreview(params: {
    origin_lat: number;
    origin_lng: number;
    dest_lat: number;
    dest_lng: number;
  }): Promise<RoutePreview> {
    const { data } = await apiClient.get<RoutePreview>('/maps/route', { params });
    return data;
  },

  async getFareEstimate(params: {
    origin_lat: number;
    origin_lng: number;
    dest_lat: number;
    dest_lng: number;
    passengers?: number;
  }): Promise<FareEstimate> {
    const { data } = await apiClient.get<FareEstimate>('/maps/fare-estimate', { params });
    return data;
  },

  async geocode(q: string): Promise<GeocodeResult[]> {
    const { data } = await apiClient.get<{ results: GeocodeResult[] }>('/maps/geocode', {
      params: { q },
    });
    return data.results ?? [];
  },

  async getCampusGates(): Promise<CampusGatesResponse> {
    const { data } = await apiClient.get<CampusGatesResponse>('/maps/gates');
    return data;
  },
};
