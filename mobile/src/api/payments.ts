import { apiClient } from './client';
import type { PaymentMethod, PaymentRead, PaymentStatus, PayResponse } from './types';

export const paymentsApi = {
  async getHistory(params?: {
    role?: 'passenger' | 'driver';
    status?: PaymentStatus;
  }): Promise<PaymentRead[]> {
    const { data } = await apiClient.get<PaymentRead[]>('/payments/history', { params });
    return data;
  },

  async getBookingPayment(bookingId: number): Promise<PaymentRead> {
    const { data } = await apiClient.get<PaymentRead>(`/payments/booking/${bookingId}`);
    return data;
  },

  async payBooking(bookingId: number, method: PaymentMethod): Promise<PayResponse> {
    const { data } = await apiClient.post<PayResponse>(`/payments/booking/${bookingId}/pay`, {
      method,
    });
    return data;
  },

  async confirmCash(bookingId: number): Promise<PaymentRead> {
    const { data } = await apiClient.post<PaymentRead>(
      `/payments/booking/${bookingId}/confirm-cash`,
    );
    return data;
  },
};
