import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  getApiError,
  ridesApi,
  safetyApi,
  tokenStorage,
  trackingApi,
  type RideRead,
  type TrackingSnapshot,
} from '../../api';
import { LiveMap } from '../../components/LiveMap';
import { Avatar, Badge, Button, ErrorBanner, Icon } from '../../components/ui';
import { colors, radii, shadows } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveRide'>;

export function ActiveRideScreen({ navigation, route }: Props) {
  const { rideId, bookingId } = route.params;
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [ride, setRide] = useState<RideRead | null>(null);
  const [carPos, setCarPos] = useState<{ lat: number; lng: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [snap, r] = await Promise.all([
          trackingApi.getRideTracking(rideId),
          ridesApi.getRide(rideId),
        ]);
        if (!active) return;
        setSnapshot(snap);
        setRide(r);
        if (snap.location) {
          setCarPos({ lat: snap.location.lat, lng: snap.location.lng });
        }

        const token = await tokenStorage.getAccessToken();
        if (token && active) {
          const ws = new WebSocket(trackingApi.getWebSocketUrl(rideId, token));
          ws.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data);
              if (data.type === 'location' && typeof data.lat === 'number') {
                setCarPos({ lat: data.lat, lng: data.lng });
              }
            } catch {
              // ignore malformed frame
            }
          };
          wsRef.current = ws;
        }
      } catch (err) {
        if (active) setError(getApiError(err, 'Could not load live tracking.'));
      }
    })();

    const poll = setInterval(() => {
      trackingApi
        .getRideTracking(rideId)
        .then((snap) => {
          setSnapshot(snap);
          if (snap.location) setCarPos({ lat: snap.location.lat, lng: snap.location.lng });
        })
        .catch(() => null);
    }, 10000);

    return () => {
      active = false;
      clearInterval(poll);
      wsRef.current?.close();
    };
  }, [rideId]);

  const handleShareTrip = async () => {
    setSharing(true);
    try {
      const res = await safetyApi.shareTrip(rideId);
      await Share.share({
        message: `Track my NED Transport Hub ride live: ${res.url}`,
      });
      Alert.alert(
        'Trip shared',
        `Notified ${res.contacts_notified} trusted contact(s) with your live link.`,
      );
    } catch (err) {
      Alert.alert('Cannot share trip', getApiError(err, 'Add a trusted contact first.'));
    } finally {
      setSharing(false);
    }
  };

  const center = carPos
    ? { latitude: carPos.lat, longitude: carPos.lng }
    : snapshot?.origin
    ? { latitude: snapshot.origin[0], longitude: snapshot.origin[1] }
    : undefined;

  const activeBookingId = bookingId ?? snapshot?.pickups?.[0]?.booking_id;

  return (
    <View style={{ flex: 1 }}>
      <LiveMap
        center={center}
        route={snapshot?.route}
        markers={[
          ...(carPos
            ? [
                {
                  id: 'car',
                  latitude: carPos.lat,
                  longitude: carPos.lng,
                  tone: 'car' as const,
                  title: snapshot?.driver_name ?? 'Driver',
                },
              ]
            : []),
          ...(snapshot?.destination
            ? [
                {
                  id: 'dest',
                  latitude: snapshot.destination[0],
                  longitude: snapshot.destination[1],
                  title: ride?.destination_name ?? 'Destination',
                },
              ]
            : []),
        ]}
      />

      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="ChevronLeft" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            Live · {ride?.destination_name ?? 'On the way to NED'}
          </Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ErrorBanner message={error} />

        <View style={styles.etaRow}>
          <View>
            <Text style={styles.etaBig}>
              {snapshot?.eta_to_destination_min
                ? `${Math.round(snapshot.eta_to_destination_min)} min away`
                : snapshot?.status === 'completed'
                ? 'Ride Completed'
                : 'On the way'}
            </Text>
            <Text style={styles.etaSub}>
              {ride ? `${ride.distance_km.toFixed(1)} km total · ${ride.origin_name}` : 'Tracking live'}
            </Text>
          </View>
          <Badge tone={snapshot?.status === 'completed' ? 'success' : 'info'}>
            {(snapshot?.status ?? 'in_progress').replace('_', ' ')}
          </Badge>
        </View>

        <View style={styles.driverRow}>
          <Avatar name={snapshot?.driver_name ?? ride?.driver.name ?? 'Driver'} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>
              {snapshot?.driver_name ?? ride?.driver.name ?? 'Driver'}
            </Text>
            <Text style={styles.driverSub}>
              {ride?.vehicle_model ?? 'Vehicle'} · {snapshot?.vehicle_plate ?? ride?.vehicle_plate ?? ''}
            </Text>
          </View>
          {ride?.driver_phone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${ride.driver_phone}`)}
              style={styles.iconCircle}
            >
              <Icon name="Phone" size={18} color={colors.brand} />
            </TouchableOpacity>
          ) : null}
          {activeBookingId ? (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Chat', {
                  bookingId: activeBookingId,
                  peerName: snapshot?.driver_name ?? ride?.driver.name ?? 'Driver',
                  subtitle: snapshot?.vehicle_plate ?? ride?.vehicle_model,
                })
              }
              style={styles.iconCircle}
            >
              <Icon name="MessageCircle" size={18} color={colors.brand} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          disabled={sharing}
          onPress={handleShareTrip}
          style={styles.shareBtn}
        >
          <Icon name="Share2" size={18} color={colors.brand} />
          <Text style={styles.shareText}>
            {sharing ? 'Sharing live link...' : 'Share trip with trusted contacts'}
          </Text>
          <Icon name="ChevronRight" size={18} color={colors.ink3} />
        </TouchableOpacity>

        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button
              variant="danger"
              icon="Siren"
              onPress={() => navigation.navigate('SosActive', { rideId, autoTrigger: true })}
            >
              SOS Alert
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              onPress={() => {
                if (activeBookingId) {
                  navigation.navigate('Payment', {
                    bookingId: activeBookingId,
                    rideId,
                    driverName: snapshot?.driver_name ?? ride?.driver.name,
                  });
                } else {
                  navigation.navigate('MainTabs', { screen: 'MyRidesTab' });
                }
              }}
            >
              Pay & Finish
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    ...shadows.card,
    flexShrink: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: { fontSize: 13, fontWeight: '700', color: colors.ink },
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
    gap: 14,
    ...shadows.sheet,
  },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etaBig: { fontSize: 22, fontWeight: '700', color: colors.ink },
  etaSub: { fontSize: 13, color: colors.ink2, marginTop: 2 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  driverSub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 13,
  },
  shareText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  actions: { flexDirection: 'row', gap: 10 },
});
