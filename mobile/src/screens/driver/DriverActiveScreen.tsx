import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  getApiError,
  ridesApi,
  tokenStorage,
  trackingApi,
  type TrackingSnapshot,
} from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { LiveMap } from '../../components/LiveMap';
import { Avatar, Button, ErrorBanner, Icon } from '../../components/ui';
import { colors, radii, shadows } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverActive'>;

export function DriverActiveScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const { showConfirm } = useDialog();
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let active = true;

    (async () => {
      try {
        const snap = await trackingApi.getRideTracking(rideId);
        if (!active) return;
        setSnapshot(snap);
        if (snap.location) {
          setCurrentCoords({ lat: snap.location.lat, lng: snap.location.lng });
        }

        const token = await tokenStorage.getAccessToken();
        if (token && active) {
          const ws = new WebSocket(trackingApi.getWebSocketUrl(rideId, token));
          wsRef.current = ws;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && active) {
          sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
            (pos) => {
              const payload = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed_kmh:
                  pos.coords.speed && pos.coords.speed > 0
                    ? Math.round(pos.coords.speed * 3.6)
                    : null,
              };
              setCurrentCoords({ lat: payload.lat, lng: payload.lng });
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(payload));
              } else {
                trackingApi.pushLocation(rideId, payload).catch(() => null);
              }
            },
          );
        }
      } catch (err) {
        if (active) setError(getApiError(err, 'Could not connect live tracking.'));
      }
    })();

    return () => {
      active = false;
      sub?.remove();
      wsRef.current?.close();
    };
  }, [rideId]);

  const handleComplete = () => {
    showConfirm({
      title: 'End ride?',
      message: 'Passengers will be prompted to pay and rate the trip.',
      confirmLabel: 'Complete Ride',
      cancelLabel: 'Not yet',
      onConfirm: async () => {
        setEnding(true);
        try {
          await ridesApi.completeRide(rideId);
          navigation.replace('DriverDone', { rideId });
        } catch (err) {
          setError(getApiError(err, 'Could not complete ride.'));
        } finally {
          setEnding(false);
        }
      },
    });
  };

  const mapCenter = currentCoords
    ? { latitude: currentCoords.lat, longitude: currentCoords.lng }
    : snapshot?.origin
    ? { latitude: snapshot.origin[0], longitude: snapshot.origin[1] }
    : undefined;

  return (
    <View style={{ flex: 1 }}>
      <LiveMap
        center={mapCenter}
        route={snapshot?.route}
        markers={[
          ...(currentCoords
            ? [
                {
                  id: 'driver',
                  latitude: currentCoords.lat,
                  longitude: currentCoords.lng,
                  tone: 'car' as const,
                  title: 'Your car',
                },
              ]
            : []),
          ...(snapshot?.pickups ?? []).map((p) => ({
            id: `p-${p.booking_id}`,
            latitude: p.lat,
            longitude: p.lng,
            title: p.passenger,
            description: p.name,
          })),
        ]}
      />

      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <View style={styles.navBanner}>
          <Icon name="Navigation" size={28} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.navSmall}>Live GPS Broadcast Active</Text>
            <Text style={styles.navBig}>
              {snapshot?.eta_to_destination_min
                ? `${Math.round(snapshot.eta_to_destination_min)} min to destination`
                : 'Heading to destination'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ErrorBanner message={error} />
        <View>
          <Text style={styles.sheetTitle}>
            {snapshot?.pickups.length ?? 0} passenger(s) on this ride
          </Text>
          <Text style={styles.sheetSub}>Vehicle: {snapshot?.vehicle_plate ?? 'Active'}</Text>
        </View>

        {(snapshot?.pickups ?? []).map((p) => (
          <View key={p.booking_id} style={styles.pRow}>
            <Avatar name={p.passenger} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pName}>{p.passenger}</Text>
              <Text style={styles.pSub}>{p.name}</Text>
            </View>
            <Icon name="CircleCheck" size={20} color={colors.success} />
          </View>
        ))}

        <View style={styles.actions}>
          <Button
            variant="danger"
            icon="Siren"
            onPress={() => navigation.navigate('SosActive', { rideId, autoTrigger: true })}
            style={{ width: 64 }}
          />
          <View style={{ flex: 1 }}>
            <Button loading={ending} onPress={handleComplete}>
              End Ride at Destination
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: { position: 'absolute', top: 0, left: 16, right: 16 },
  navBanner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brand,
    borderRadius: radii.lg,
    padding: 16,
    ...shadows.card,
  },
  navSmall: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  navBig: { fontSize: 16, fontWeight: '700', color: colors.white, marginTop: 2 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
    ...shadows.sheet,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  sheetSub: { fontSize: 13, color: colors.ink2, marginTop: 2 },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pSub: { fontSize: 12, color: colors.ink2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
