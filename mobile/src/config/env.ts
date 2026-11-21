import { Platform } from 'react-native';

function getDefaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = getDefaultBaseUrl();
export const API_PREFIX = '/api/v1';
export const API_URL = `${API_BASE_URL}${API_PREFIX}`;

export function getWsUrl(path: string): string {
  const wsBase = API_BASE_URL.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsBase}${API_PREFIX}${cleanPath}`;
}

export const NED_UNIVERSITY_COORDS = {
  latitude: 24.9300,
  longitude: 67.1140,
  name: 'NED University, Main Gate',
};

export const KARACHI_PRESETS = [
  { name: 'NED University, Main Gate', area: 'University Road', lat: 24.9300, lng: 67.1140 },
  { name: 'NED University, Gate 2', area: 'University Road', lat: 24.9312, lng: 67.1162 },
  { name: 'Gulshan-e-Iqbal, Block 13', area: 'Near Disco Bakery', lat: 24.9204, lng: 67.0942 },
  { name: 'Maskan Chowrangi', area: 'Gulshan-e-Iqbal Block 7', lat: 24.9265, lng: 67.1052 },
  { name: 'NIPA Chowrangi', area: 'Rashid Minhas Road', lat: 24.9178, lng: 67.0971 },
  { name: 'Johar Morr', area: 'Gulistan-e-Johar', lat: 24.9154, lng: 67.1235 },
  { name: 'North Nazimabad, Hyderi', area: 'Block G', lat: 24.9375, lng: 67.0432 },
  { name: 'PECHS, Nursery', area: 'Shahrah-e-Faisal', lat: 24.8615, lng: 67.0642 },
];
