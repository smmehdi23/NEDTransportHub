import { apiClient } from './client';
import type { ContactRead, MessageResponse, ReportRead, ShareRead, SOSRead } from './types';

export const safetyApi = {
  async listContacts(): Promise<ContactRead[]> {
    const { data } = await apiClient.get<ContactRead[]>('/safety/contacts');
    return data;
  },

  async addContact(payload: { name: string; phone: string }): Promise<ContactRead> {
    const { data } = await apiClient.post<ContactRead>('/safety/contacts', payload);
    return data;
  },

  async deleteContact(contactId: number): Promise<MessageResponse> {
    const { data } = await apiClient.delete<MessageResponse>(`/safety/contacts/${contactId}`);
    return data;
  },

  async shareTrip(rideId: number): Promise<ShareRead> {
    const { data } = await apiClient.post<ShareRead>(`/safety/trips/${rideId}/share`);
    return data;
  },

  async triggerSos(payload: {
    ride_id: number;
    lat?: number | null;
    lng?: number | null;
    message?: string | null;
  }): Promise<SOSRead> {
    const { data } = await apiClient.post<SOSRead>('/safety/sos', payload);
    return data;
  },

  async createReport(payload: {
    ride_id: number;
    reported_user_id?: number | null;
    description: string;
  }): Promise<ReportRead> {
    const { data } = await apiClient.post<ReportRead>('/safety/reports', payload);
    return data;
  },

  async getMyReports(): Promise<ReportRead[]> {
    const { data } = await apiClient.get<ReportRead[]>('/safety/reports/mine');
    return data;
  },
};
