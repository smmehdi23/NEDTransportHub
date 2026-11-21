import { apiClient } from './client';
import type { BookingCreate, BookingRead, BookingStatus } from './types';

export const bookingsApi = {
  async requestSeat(payload: BookingCreate): Promise<BookingRead> {
    const { data } = await apiClient.post<BookingRead>('/bookings', payload);
    return data;
  },

  async listBookings(params?: {
    as_driver?: boolean;
    status?: BookingStatus;
    ride_id?: number;
  }): Promise<BookingRead[]> {
    const { data } = await apiClient.get<BookingRead[]>('/bookings', { params });
    return data;
  },

  async getBooking(bookingId: number): Promise<BookingRead> {
    const { data } = await apiClient.get<BookingRead>(`/bookings/${bookingId}`);
    return data;
  },

  async respondToBooking(
    bookingId: number,
    payload: { action: 'accept' | 'reject'; fare?: number; reason?: string },
  ): Promise<BookingRead> {
    const { data } = await apiClient.post<BookingRead>(`/bookings/${bookingId}/respond`, payload);
    return data;
  },

  async decideFare(bookingId: number, accept: boolean): Promise<BookingRead> {
    const { data } = await apiClient.post<BookingRead>(`/bookings/${bookingId}/fare`, { accept });
    return data;
  },

  async cancelBooking(bookingId: number, reason?: string): Promise<BookingRead> {
    const { data } = await apiClient.post<BookingRead>(`/bookings/${bookingId}/cancel`, { reason });
    return data;
  },
};
