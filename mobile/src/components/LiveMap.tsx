import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
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

export function LiveMap({
  style,
  center = { latitude: NED_UNIVERSITY_COORDS.latitude, longitude: NED_UNIVERSITY_COORDS.longitude },
  route = [],
  markers = [],
  onPressCoordinate,
  interactive = true,
}: LiveMapProps) {
  const html = useMemo(() => {
    const safeMarkers = markers.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lng: m.longitude,
      title: m.title ?? '',
      label: m.label ?? '',
      tone: m.tone ?? 'brand',
    }));
    const safeRoute = route ?? [];

    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e6ecf5; }
    .pill-marker {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 6px 12px; border-radius: 999px; font: 700 12px -apple-system, sans-serif;
      border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); white-space: nowrap;
    }
    .pill-brand { background: #142c5c; color: #fff; }
    .pill-white { background: #fff; color: #142c5c; }
    .car-marker {
      width: 34px; height: 34px; border-radius: 17px; background: #142c5c;
      border: 3px solid #fff; color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 16px; box-shadow: 0 3px 12px rgba(20,44,92,0.45);
    }
    .pin-dot {
      width: 18px; height: 18px; border-radius: 9px; background: #142c5c;
      border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      if (typeof L === 'undefined') return;
      var map = L.map('map', {
        zoomControl: false,
        dragging: ${interactive ? 'true' : 'false'},
        scrollWheelZoom: ${interactive ? 'true' : 'false'},
        touchZoom: ${interactive ? 'true' : 'false'}
      }).setView([${center.latitude}, ${center.longitude}], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);

      var routePts = ${JSON.stringify(safeRoute)};
      if (routePts.length >= 2) {
        var line = L.polyline(routePts, { color: '#142c5c', weight: 4, opacity: 0.9 }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [40, 40] });
      }

      var markers = ${JSON.stringify(safeMarkers)};
      markers.forEach(function(m) {
        var icon;
        if (m.label) {
          var cls = m.tone === 'white' ? 'pill-white' : 'pill-brand';
          icon = L.divIcon({ className: '', html: '<div class="pill-marker ' + cls + '">' + m.label + '</div>', iconSize: [80, 30], iconAnchor: [40, 15] });
        } else if (m.tone === 'car') {
          icon = L.divIcon({ className: '', html: '<div class="car-marker">&#128663;</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
        } else {
          icon = L.divIcon({ className: '', html: '<div class="pin-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
        }
        var mk = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
        if (m.title) mk.bindPopup(m.title);
        mk.on('click', function() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: m.id }));
        });
      });

      map.on('click', function(e) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'press',
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        }));
      });
    })();
  </script>
</body>
</html>`;
  }, [center.latitude, center.longitude, interactive, markers, route]);

  if (Platform.OS === 'web') {
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

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'press' && onPressCoordinate) {
              onPressCoordinate({ latitude: msg.latitude, longitude: msg.longitude });
            } else if (msg.type === 'marker') {
              const target = markers.find((m) => m.id === msg.id);
              target?.onPress?.();
            }
          } catch {
            // ignore malformed messages
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e6ecf5',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#e6ecf5',
  },
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
});
