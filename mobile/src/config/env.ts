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
  { name: 'NED University, LEJ Campus', area: 'Gulistan-e-Johar', lat: 24.9345, lng: 67.1185 },
  { name: 'Gulshan-e-Iqbal, Block 13', area: 'Near Disco Bakery', lat: 24.9204, lng: 67.0942 },
  { name: 'Disco Bakery', area: 'Gulshan-e-Iqbal Block 4', lat: 24.9225, lng: 67.0968 },
  { name: 'Maskan Chowrangi', area: 'Gulshan-e-Iqbal Block 7', lat: 24.9265, lng: 67.1052 },
  { name: 'Safari Park', area: 'University Road', lat: 24.9234, lng: 67.1098 },
  { name: 'NIPA Chowrangi', area: 'Rashid Minhas Road', lat: 24.9178, lng: 67.0971 },
  { name: 'Hassan Square', area: 'Gulshan-e-Iqbal', lat: 24.9001, lng: 67.0748 },
  { name: 'Johar Morr', area: 'Gulistan-e-Johar', lat: 24.9154, lng: 67.1235 },
  { name: 'Johar Chowrangi', area: 'Gulistan-e-Johar', lat: 24.9199, lng: 67.1332 },
  { name: 'Safoora Chowrangi', area: 'Scheme 33', lat: 24.9410, lng: 67.1526 },
  { name: 'North Nazimabad, Hyderi', area: 'Block G', lat: 24.9375, lng: 67.0432 },
  { name: 'Five Star Chowrangi', area: 'North Nazimabad Block L', lat: 24.9462, lng: 67.0493 },
  { name: 'Nazimabad No. 7', area: 'Nazimabad', lat: 24.9145, lng: 67.0332 },
  { name: 'Buffer Zone', area: 'North Karachi', lat: 24.9605, lng: 67.0620 },
  { name: 'Federal B Area, Water Pump', area: 'Shahrah-e-Pakistan', lat: 24.9360, lng: 67.0772 },
  { name: 'PECHS, Nursery', area: 'Shahrah-e-Faisal', lat: 24.8615, lng: 67.0642 },
  { name: 'Bahadurabad', area: 'Char Minar Chowrangi', lat: 24.8825, lng: 67.0695 },
  { name: 'Tariq Road', area: 'PECHS Block 2', lat: 24.8719, lng: 67.0596 },
  { name: 'Clifton, Teen Talwar', area: 'Clifton Block 8', lat: 24.8325, lng: 67.0338 },
  { name: 'Clifton, Do Talwar', area: 'Clifton', lat: 24.8386, lng: 67.0320 },
  { name: 'DHA Phase 2', area: 'Defence Housing Authority', lat: 24.8305, lng: 67.0706 },
  { name: 'DHA Phase 6', area: 'Bukhari Commercial', lat: 24.8058, lng: 67.0621 },
  { name: 'Saddar, Empress Market', area: 'Saddar Town', lat: 24.8632, lng: 67.0268 },
  { name: 'Malir Halt', area: 'Shahrah-e-Faisal', lat: 24.8834, lng: 67.1774 },
  { name: 'Karsaz', area: 'Shahrah-e-Faisal', lat: 24.8819, lng: 67.0942 },
];
