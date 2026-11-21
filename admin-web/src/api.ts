export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'https://ned-transport-hub.vercel.app'
).replace(/\/+$/, '');
const API_URL = `${API_BASE}/api/v1`;

const ACCESS_KEY = 'nth_admin_access';
const REFRESH_KEY = 'nth_admin_refresh';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  save: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: 'rider' | 'driver' | 'admin';
  account_status: 'active' | 'suspended' | 'removed';
  status_reason?: string | null;
  is_email_verified: boolean;
  is_driver_verified: boolean;
  created_at: string;
  updated_at?: string;
}

export interface VehicleReview {
  id: number;
  plate_number: string;
  model: string;
  seat_capacity: number;
  verification_status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  owner: { id: number; name: string; email: string; phone: string | null };
  documents: { licence: string; registration: string; university_id: string };
}

export interface RideItem {
  id: number;
  driver: { id: number; name: string; rating_avg: number | null; rating_count: number };
  vehicle_model: string;
  origin_name: string;
  destination_name: string;
  distance_km: number;
  duration_min: number;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  estimated_fare: number;
  status: 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface BookingItem {
  id: number;
  ride_id: number;
  passenger: { id: number; name: string; phone: string | null };
  pickup_name: string | null;
  dropoff_name: string | null;
  status: string;
  proposed_fare: number | null;
  fare_status: string;
  created_at: string;
}

export interface SOSItem {
  id: number;
  user_id: number;
  ride_id: number;
  lat: number | null;
  lng: number | null;
  message: string | null;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at: string | null;
}

export interface ReportItem {
  id: number;
  ride_id: number;
  reporter_id: number;
  reported_user_id: number | null;
  description: string;
  status: 'open' | 'in_review' | 'resolved';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  users: { total: number; by_status: Record<string, number>; verified_drivers: number };
  rides: { total: number; by_status: Record<string, number> };
  bookings: { total: number; by_status: Record<string, number> };
  payments: { by_status: Record<string, number>; total_paid_pkr: number };
  safety: { active_sos: number; open_reports: number };
  activity: {
    days: number;
    rides_created: Record<string, number>;
    bookings_made: Record<string, number>;
  };
}

export interface RatingSummary {
  user_id: number;
  average: number | null;
  count: number;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return null;
  }
  const data = await res.json();
  tokenStore.save(data.access_token, data.refresh_token);
  return data.access_token;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = tokenStore.getAccess();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, init, false);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') msg = body.detail;
      else if (Array.isArray(body?.detail) && body.detail[0]?.msg) msg = body.detail[0].msg;
    } catch {
      // keep fallback
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchDocumentBlob(docPath: string): Promise<{ url: string; mime: string }> {
  const token = tokenStore.getAccess();
  const fullUrl = docPath.startsWith('http') ? docPath : `${API_BASE}${docPath}`;
  const res = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Document unavailable (${res.status})`);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mime: blob.type || 'application/octet-stream' };
}

export const adminApi = {
  async login(email: string, password: string): Promise<AdminUser> {
    const tokens = await request<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    tokenStore.save(tokens.access_token, tokens.refresh_token);
    const me = await request<AdminUser>('/users/me');
    if (me.role !== 'admin') {
      tokenStore.clear();
      throw new Error('Access denied. Only NED transport administrators can sign in here.');
    }
    return me;
  },

  async logout() {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: tokenStore.getRefresh() }),
      });
    } finally {
      tokenStore.clear();
    }
  },

  getMe: () => request<AdminUser>('/users/me'),
  getStats: (days = 7) => request<AdminStats>(`/admin/stats?days=${days}`),

  listUsers: (params?: { role?: string; status?: string; search?: string; page?: number }) => {
    const q = new URLSearchParams({ page_size: '50' });
    if (params?.role) q.set('role', params.role);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    return request<{ items: AdminUser[]; total: number }>(`/admin/users?${q.toString()}`);
  },

  getUser: (id: number) => request<AdminUser>(`/admin/users/${id}`),
  getUserRating: (id: number) => request<RatingSummary>(`/ratings/users/${id}`),

  updateUserStatus: (id: number, status: 'active' | 'suspended' | 'removed', reason?: string) =>
    request<AdminUser>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason: reason || null }),
    }),

  listVerifications: (status: 'pending' | 'verified' | 'rejected' = 'pending') =>
    request<{ items: VehicleReview[]; total: number }>(
      `/admin/driver-verifications?status=${status}&page_size=50`,
    ),

  getVerification: (vehicleId: number) =>
    request<VehicleReview>(`/admin/driver-verifications/${vehicleId}`),

  approveDriver: (vehicleId: number) =>
    request<VehicleReview>(`/admin/driver-verifications/${vehicleId}/approve`, { method: 'POST' }),

  rejectDriver: (vehicleId: number, reason: string) =>
    request<VehicleReview>(`/admin/driver-verifications/${vehicleId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  listRides: (status?: string) => {
    const q = new URLSearchParams({ page_size: '50' });
    if (status) q.set('status', status);
    return request<{ items: RideItem[]; total: number }>(`/admin/rides?${q.toString()}`);
  },

  getRideBookings: (rideId: number) => request<BookingItem[]>(`/admin/rides/${rideId}/bookings`),

  cancelRide: (rideId: number, reason?: string) =>
    request<{ message: string }>(`/admin/rides/${rideId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Cancelled by administrator' }),
    }),

  listSos: (status?: 'active' | 'resolved') =>
    request<SOSItem[]>(status ? `/admin/sos?status=${status}` : '/admin/sos?status='),

  resolveSos: (sosId: number) =>
    request<SOSItem>(`/admin/sos/${sosId}/resolve`, { method: 'POST' }),

  listReports: (status?: string) =>
    request<ReportItem[]>(status ? `/admin/reports?status=${status}` : '/admin/reports'),

  updateReport: (reportId: number, status: 'open' | 'in_review' | 'resolved', admin_notes?: string) =>
    request<ReportItem>(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_notes }),
    }),
};
