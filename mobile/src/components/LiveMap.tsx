import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { NED_UNIVERSITY_COORDS } from '../config/env';
import { colors, shadows } from '../theme';
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
  const webViewRef = useRef<React.ComponentRef<typeof WebView>>(null);
  const readyRef = useRef(false);
  const [mapStyle, setMapStyle] = useState<'voyager' | 'satellite'>('voyager');

  // Keep latest callbacks in refs so the persistent WebView never reloads
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const onPressRef = useRef(onPressCoordinate);
  onPressRef.current = onPressCoordinate;

  const serializedPayload = useMemo(() => {
    const safeMarkers = markers.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lng: m.longitude,
      title: m.title ?? '',
      label: m.label ?? '',
      tone: m.tone ?? 'brand',
    }));
    return JSON.stringify({
      center: [center.latitude, center.longitude],
      route: route ?? [],
      markers: safeMarkers,
      interactive,
      style: mapStyle,
    });
  }, [center.latitude, center.longitude, route, markers, interactive, mapStyle]);

  const payloadRef = useRef(serializedPayload);
  payloadRef.current = serializedPayload;

  // Build HTML ONCE so the WebView never tears down or flickers on marker/GPS/pin updates
  const initialHtml = useMemo(() => {
    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #eef3f9; overflow: hidden; }
    .leaflet-control-attribution { display: none !important; }
    .pill-marker {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 6px 12px; border-radius: 999px; font: 700 12px -apple-system, BlinkMacSystemFont, sans-serif;
      border: 2px solid #fff; box-shadow: 0 4px 12px rgba(9,29,72,0.28); white-space: nowrap;
    }
    .pill-brand { background: #142c5c; color: #fff; }
    .pill-white { background: #fff; color: #142c5c; }
    .car-wrap {
      position: relative; width: 42px; height: 42px;
      display: flex; align-items: center; justify-content: center;
    }
    .car-pulse {
      position: absolute; width: 42px; height: 42px; border-radius: 21px;
      background: rgba(56, 132, 255, 0.28); animation: pulse 2s ease-out infinite;
    }
    .car-marker {
      position: relative; width: 32px; height: 32px; border-radius: 16px; background: #142c5c;
      border: 3px solid #fff; color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 15px; box-shadow: 0 3px 12px rgba(20,44,92,0.45);
    }
    @keyframes pulse {
      0% { transform: scale(0.75); opacity: 0.9; }
      100% { transform: scale(1.65); opacity: 0; }
    }
    .pin-dot {
      width: 20px; height: 20px; border-radius: 10px; background: #142c5c;
      border: 3px solid #fff; box-shadow: 0 3px 10px rgba(9,29,72,0.35);
    }
    .pin-dot-success {
      background: #15803d;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      if (typeof L === 'undefined') return;
      var init = ${payloadRef.current};

      var map = L.map('map', {
        zoomControl: false,
        preferCanvas: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
        inertiaDeceleration: 2800,
        dragging: !!init.interactive,
        scrollWheelZoom: !!init.interactive,
        touchZoom: !!init.interactive,
        doubleClickZoom: !!init.interactive
      }).setView(init.center, 15);

      var voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        detectRetina: true,
        keepBuffer: 4,
        updateWhenIdle: false,
        updateWhenZooming: false
      });

      var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        keepBuffer: 4,
        updateWhenIdle: false
      });

      var currentStyle = 'voyager';
      voyagerLayer.addTo(map);

      var routeGroup = L.layerGroup().addTo(map);
      var markerGroup = L.layerGroup().addTo(map);
      var lastRouteKey = '';
      var lastCenterKey = init.center.join(',');

      function renderPayload(data) {
        if (!data) return;

        // 1. Switch tile style if requested
        var wantStyle = data.style === 'satellite' ? 'satellite' : 'voyager';
        if (wantStyle !== currentStyle) {
          if (wantStyle === 'satellite') {
            map.removeLayer(voyagerLayer);
            satelliteLayer.addTo(map);
          } else {
            map.removeLayer(satelliteLayer);
            voyagerLayer.addTo(map);
          }
          currentStyle = wantStyle;
        }

        // 2. Render route polyline (dual stroke for modern Uber/Careem clarity)
        var routePts = data.route || [];
        var routeKey = routePts.length >= 2
          ? routePts.length + ':' + routePts[0][0].toFixed(4) + ',' + routePts[0][1].toFixed(4) + '>' + routePts[routePts.length - 1][0].toFixed(4) + ',' + routePts[routePts.length - 1][1].toFixed(4)
          : '';
        if (routeKey !== lastRouteKey) {
          routeGroup.clearLayers();
          if (routePts.length >= 2) {
            L.polyline(routePts, { color: '#091d48', weight: 7, opacity: 0.28, lineCap: 'round', lineJoin: 'round' }).addTo(routeGroup);
            var line = L.polyline(routePts, { color: '#1d4ed8', weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(routeGroup);
            map.fitBounds(line.getBounds(), { padding: [44, 44], maxZoom: 16, animate: true });
          }
          lastRouteKey = routeKey;
        }

        // 3. Smooth pan when center changes (and no route locked bounds)
        var centerKey = data.center ? data.center.join(',') : '';
        if (centerKey && centerKey !== lastCenterKey && routePts.length < 2) {
          map.panTo(data.center, { animate: true, duration: 0.4 });
          lastCenterKey = centerKey;
        }

        // 4. Update markers in-place without reloading map
        markerGroup.clearLayers();
        (data.markers || []).forEach(function(m) {
          var icon;
          if (m.label) {
            var cls = m.tone === 'white' ? 'pill-white' : 'pill-brand';
            icon = L.divIcon({
              className: '',
              html: '<div class="pill-marker ' + cls + '">' + m.label + '</div>',
              iconSize: [88, 30],
              iconAnchor: [44, 15]
            });
          } else if (m.tone === 'car') {
            icon = L.divIcon({
              className: '',
              html: '<div class="car-wrap"><div class="car-pulse"></div><div class="car-marker">&#128663;</div></div>',
              iconSize: [42, 42],
              iconAnchor: [21, 21]
            });
          } else {
            var dotCls = m.tone === 'success' ? 'pin-dot pin-dot-success' : 'pin-dot';
            icon = L.divIcon({
              className: '',
              html: '<div class="' + dotCls + '"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
          }
          var mk = L.marker([m.lat, m.lng], { icon: icon }).addTo(markerGroup);
          if (m.title) mk.bindPopup(m.title);
          mk.on('click', function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: m.id }));
          });
        });
      }

      window.__updateMap = renderPayload;
      renderPayload(init);

      map.on('click', function(e) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'press',
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        }));
      });

      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    })();
  </script>
</body>
</html>`;
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    webViewRef.current?.injectJavaScript(
      `window.__updateMap && window.__updateMap(${serializedPayload}); true;`,
    );
  }, [serializedPayload]);

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
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: initialHtml }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        androidLayerType="hardware"
        scrollEnabled={false}
        onLoadEnd={() => {
          readyRef.current = true;
          webViewRef.current?.injectJavaScript(
            `window.__updateMap && window.__updateMap(${payloadRef.current}); true;`,
          );
        }}
        onMessage={(event: WebViewMessageEvent) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'ready') {
              readyRef.current = true;
              webViewRef.current?.injectJavaScript(
                `window.__updateMap && window.__updateMap(${payloadRef.current}); true;`,
              );
            } else if (msg.type === 'press' && onPressRef.current) {
              onPressRef.current({ latitude: msg.latitude, longitude: msg.longitude });
            } else if (msg.type === 'marker') {
              const target = markersRef.current.find((m) => m.id === msg.id);
              target?.onPress?.();
            }
          } catch {
            // ignore malformed messages
          }
        }}
      />

      {interactive ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setMapStyle((s) => (s === 'voyager' ? 'satellite' : 'voyager'))}
          style={styles.styleBtn}
        >
          <Icon name="Map" size={14} color={colors.brand} />
          <Text style={styles.styleBtnText}>{mapStyle === 'voyager' ? 'Satellite' : 'Street'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef3f9',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: '#eef3f9',
  },
  styleBtn: {
    position: 'absolute',
    right: 12,
    top: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    ...shadows.card,
  },
  styleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
  },
  fallback: {
    flex: 1,
    backgroundColor: '#eef3f9',
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
