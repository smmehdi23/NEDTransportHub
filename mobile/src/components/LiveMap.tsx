import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { NED_UNIVERSITY_COORDS } from '../config/env';
import { colors } from '../theme';
import { DecorativeMapBg, Icon } from './ui';

export interface MapMarkerItem {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  label?: string;
  tone?: 'brand' | 'white' | 'car' | 'success';
  onPress?: () => void;
}

interface LiveMapProps {
  style?: StyleProp<ViewStyle>;
  center?: { latitude: number; longitude: number };
  route?: [number, number][];
  markers?: MapMarkerItem[];
  onPressCoordinate?: (coords: { latitude: number; longitude: number }) => void;
  interactive?: boolean;
}

// Lazy-require react-native-maps on native platforms so Expo Web never fails to bundle
let NativeMapView: React.ComponentType<any> | null = null;
let NativeMarker: React.ComponentType<any> | null = null;
let NativePolyline: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    NativeMapView = maps.default;
    NativeMarker = maps.Marker;
    NativePolyline = maps.Polyline;
  } catch {
    NativeMapView = null;
  }
}

export function LiveMap({
  style,
  center = { latitude: NED_UNIVERSITY_COORDS.latitude, longitude: NED_UNIVERSITY_COORDS.longitude },
  route,
  markers = [],
  onPressCoordinate,
  interactive = true,
}: LiveMapProps) {
  if (!NativeMapView) {
    return (
      <View style={[styles.fallback, style]}>
        <DecorativeMapBg />
        <View style={styles.fallbackBadge}>
          <Icon name="MapPin" size={16} color={colors.brand} />
          <Text style={styles.fallbackText}>
            {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
          </Text>
        </View>
      </View>
    );
  }

  const polylineCoords = (route ?? []).map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));

  return (
    <NativeMapView
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      }}
      region={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      }}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      onPress={(e: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
        const coord = e?.nativeEvent?.coordinate;
        if (coord && onPressCoordinate) {
          onPressCoordinate(coord);
        }
      }}
    >
      {NativePolyline && polylineCoords.length >= 2 ? (
        <NativePolyline
          coordinates={polylineCoords}
          strokeColor={colors.brand}
          strokeWidth={4}
        />
      ) : null}

      {NativeMarker &&
        markers.map((m) => (
          <NativeMarker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.description}
            onPress={m.onPress}
          >
            {m.label ? (
              <View
                style={[
                  styles.pillMarker,
                  m.tone === 'white'
                    ? { backgroundColor: colors.white }
                    : { backgroundColor: colors.brand },
                ]}
              >
                <Text
                  style={[
                    styles.pillMarkerText,
                    { color: m.tone === 'white' ? colors.brand : colors.white },
                  ]}
                >
                  {m.label}
                </Text>
              </View>
            ) : m.tone === 'car' ? (
              <View style={styles.carMarker}>
                <Icon name="Car" size={18} color={colors.white} />
              </View>
            ) : undefined}
          </NativeMarker>
        ))}
    </NativeMapView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#e6ecf5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  fallbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
  },
  pillMarker: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pillMarkerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  carMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
