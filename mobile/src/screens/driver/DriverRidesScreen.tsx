import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, ridesApi, type RideRead } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { Badge, Button, Card, ErrorBanner, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatDateShort, formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRides'>;

export function DriverRidesScreen({ navigation }: Props) {
  const { showConfirm, showToast } = useDialog();
  const [tab, setTab] = useState<'Upcoming' | 'Completed' | 'Cancelled'>('Upcoming');
  const [rides, setRides] = useState<RideRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await ridesApi.browseRides({ mine: true, page_size: 50 });
      setRides(page.items);
    } catch (err) {
      setError(getApiError(err, 'Could not load your rides.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = rides.filter((r) => {
    if (tab === 'Upcoming') return r.status === 'open' || r.status === 'full' || r.status === 'in_progress';
    if (tab === 'Completed') return r.status === 'completed';
    return r.status === 'cancelled';
  });

  const handleCancelRide = (ride: RideRead) => {
    showConfirm({
      title: 'Cancel this ride?',
      message: 'All booked passengers will be notified.',
      confirmLabel: 'Cancel Ride',
      cancelLabel: 'Keep',
      destructive: true,
      onConfirm: async () => {
        try {
          await ridesApi.cancelRide(ride.id, 'Driver cancelled ride');
          showToast({
            title: 'Ride cancelled',
            message: 'Booked passengers have been notified.',
            tone: 'info',
          });
          load();
        } catch (err) {
          setError(getApiError(err, 'Could not cancel ride.'));
        }
      },
    });
  };

  return (
    <Screen>
      <TopBar
        title="My rides"
        onBack={() => navigation.goBack()}
        right={<Badge tone="info">As driver</Badge>}
      />
      <View style={styles.content}>
        <View style={styles.tabs}>
          {(['Upcoming', 'Completed', 'Cancelled'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, tab === t && { color: colors.white }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
        ) : filtered.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
            <Text style={styles.emptyText}>No {tab.toLowerCase()} rides yet.</Text>
            {tab === 'Upcoming' ? (
              <Button small icon="Plus" onPress={() => navigation.navigate('OfferRide')}>
                Offer a Ride
              </Button>
            ) : null}
          </Card>
        ) : (
          filtered.map((ride) => {
            const booked = ride.total_seats - ride.available_seats;
            const tone =
              ride.status === 'in_progress'
                ? 'success'
                : ride.status === 'full'
                ? 'warning'
                : ride.status === 'cancelled'
                ? 'danger'
                : 'info';
            return (
              <Card
                key={ride.id}
                onPress={() =>
                  ride.status === 'in_progress'
                    ? navigation.navigate('DriverActive', { rideId: ride.id })
                    : ride.status === 'completed'
                    ? navigation.navigate('DriverDone', { rideId: ride.id })
                    : navigation.navigate('DriverRequests', { rideId: ride.id })
                }
                style={{ gap: 8 }}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.rideTime}>
                    {formatTime(ride.departure_time)} · {formatDateShort(ride.departure_time)}
                  </Text>
                  <Badge tone={tone}>{ride.status.replace('_', ' ')}</Badge>
                </View>
                <Text style={styles.routeText}>
                  {ride.origin_name} → {ride.destination_name}
                </Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.seatsText}>
                    {booked} of {ride.total_seats} seats booked · {formatPkr(ride.estimated_fare)}
                  </Text>
                  {ride.status === 'open' || ride.status === 'full' ? (
                    <TouchableOpacity onPress={() => handleCancelRide(ride)}>
                      <Text style={styles.cancelLink}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}

        <Button icon="Plus" onPress={() => navigation.navigate('OfferRide')}>
          Offer Another Ride
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.brand },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rideTime: { fontSize: 15, fontWeight: '700', color: colors.ink },
  routeText: { fontSize: 14, color: colors.ink2 },
  seatsText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  cancelLink: { fontSize: 13, fontWeight: '700', color: colors.danger },
  emptyText: { fontSize: 14, color: colors.ink2 },
});
