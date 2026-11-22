import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config/env';
import { tokenStorage } from './storage';
import type { TokenResponse } from './types';

type UnauthorizedListener = (reason?: string) => void;
let onUnauthorized: UnauthorizedListener | null = null;

export function setUnauthorizedListener(cb: UnauthorizedListener | null) {
  onUnauthorized = cb;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const url = originalRequest?.url || '';

    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/verify-email') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password');

    const detailMsg = String((error.response?.data as { detail?: unknown })?.detail ?? '');
    const isAccountBlocked =
      detailMsg.toLowerCase().includes('suspended') || detailMsg.toLowerCase().includes('removed');
    if ((status === 403 || status === 401) && !isAuthRoute && isAccountBlocked) {
      await tokenStorage.clearTokens();
      onUnauthorized?.(
        detailMsg
          ? `${detailMsg} Please contact NED Transport Admin.`
          : 'Your account has been suspended. Please contact NED Transport Admin.',
      );
      return Promise.reject(error);
    }

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          if (newToken && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        const { data } = await axios.post<TokenResponse>(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        await tokenStorage.saveTokens(data.access_token, data.refresh_token);
        processQueue(null, data.access_token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStorage.clearTokens();
        const reason = getApiError(
          refreshError,
          'Your session expired or your account was suspended. Please sign in again.',
        );
        onUnauthorized?.(reason);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export function getApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Cannot reach the server. Check your network and backend URL.';
    }
    const detail = (error.response.data as { detail?: unknown })?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string; loc?: string[] };
      if (first?.msg) {
        return first.msg.replace(/^Value error,\s*/i, '');
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
