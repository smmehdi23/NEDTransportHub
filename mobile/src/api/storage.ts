import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'nth_access_token';
const REFRESH_TOKEN_KEY = 'nth_refresh_token';
const OFFLINE_BOOKING_KEY = 'nth_offline_last_booking';

async function setSecure(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function getSecure(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val !== null) return val;
  } catch {
    // Fallback to AsyncStorage if Android KeyStore is unavailable
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function deleteSecure(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      setSecure(ACCESS_TOKEN_KEY, accessToken),
      setSecure(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async getAccessToken(): Promise<string | null> {
    return getSecure(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken(): Promise<string | null> {
    return getSecure(REFRESH_TOKEN_KEY);
  },
  async clearTokens(): Promise<void> {
    await Promise.all([
      deleteSecure(ACCESS_TOKEN_KEY),
      deleteSecure(REFRESH_TOKEN_KEY),
    ]);
  },
};

export interface CachedBookingSnapshot {
  bookingId: number;
  rideId: number;
  driverName?: string;
  pickupName: string;
  destinationName: string;
  departureTime: string;
  fare?: number | null;
  syncedAt: string;
}

export const offlineCache = {
  async saveLastBooking(snapshot: CachedBookingSnapshot): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_BOOKING_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore cache write failure
    }
  },
  async getLastBooking(): Promise<CachedBookingSnapshot | null> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_BOOKING_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CachedBookingSnapshot;
    } catch {
      return null;
    }
  },
};
