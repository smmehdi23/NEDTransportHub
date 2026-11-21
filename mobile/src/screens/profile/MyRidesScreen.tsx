import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, historyApi, type BookingRead, type HistoryItem } from '../../api';
import { Badge, Button, Card, ErrorBanner, Screen, TopBar } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radii } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

export function MyRidesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [tab, setTab] = useState<'Active' | 'Past'>('Active');
  const [bookings, setBookings] = useState<BookingRead[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bList, hList] = await Promise.all([
        bookingsApi.listBookings({ as_driver: false }).catch(() => []),
        historyApi.getMyHistory({ role: 'passenger', limit: 50 }).catch(() => []),
      ]);
      setBookings(bList);
      setHistory(hList);
    } catch (err) {
      setError(getApiError(err, 'Could not load rides.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeBookings = bookings.filter(
    (b) =>
      (b.status === 'pending' || b.status === 'confirmed') &&
      b.ride_status !== 'completed' &&
      b.ride_status !== 'cancelled',
  );
  const pastHistory = history.filter((h) => h.bucket !== 'upcoming');

  const openBooking = (b: BookingRead) => {
    if (b.ride_status === 'in_progress') {
      navigation.navigate('ActiveRide', { rideId: b.ride_id, bookingId: b.id });
    } else if (b.status === 'pending' && b.fare_status === 'proposed') {
      navigation.navigate('FareReview', { bookingId: b.id, booking: b });
    } else if (b.status === 'confirmed') {
      navigation.navigate('BookingConfirmed', { bookingId: b.id, rideId: b.ride_id });
    } else {
      navigation.navigate('WaitingForSeats', { bookingId: b.id, rideId: b.ride_id });
    }
  };

  return (
    <Screen>
      <TopBar title="My rides" />
      <View style={styles.content}>
        <View style={styles.tabs}>
          {(['Active', 'Past'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && { color: colors.white }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
        ) : tab === 'Active' ? (
          activeBookings.length === 0 ? (
            <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
              <Text style={styles.sub}>No active bookings right now.</Text>
              <Button small icon="Search" onPress={() => navigation.navigate('FindRide')}>
                Find a Ride
              </Button>
            </Card>
          ) : (
            activeBookings.map((b) => (
              <Card key={b.id} onPress={() => openBooking(b)} style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title}>{formatDateTime(b.departure_time)}</Text>
                  <Badge
                    tone={
                      b.status === 'confirmed'
                        ? 'success'
                        : b.fare_status === 'proposed'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {b.status === 'pending' && b.fare_status === 'proposed'
                      ? 'Review Fare'
                      : b.status}
                  </Badge>
                </View>
                <Text style={styles.sub}>
                  {b.origin_name} → {b.destination_name}
                </Text>
                <Text style={styles.fare}>{formatPkr(b.proposed_fare)}</Text>
              </Card>
            ))
          )
        ) : (
          <>
            {pastHistory.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={styles.sub}>No past rides yet.</Text>
              </Card>
            ) : (
              pastHistory.map((h) => (
                <Card
                  key={`${h.role}-${h.ride_id}-${h.booking_id ?? 0}`}
                  onPress={() => {
                    if (h.bucket === 'completed' && h.booking_id) {
                      navigation.navigate('Payment', {
                        bookingId: h.booking_id,
                        rideId: h.ride_id,
                      });
                    }
                  }}
                  style={{ gap: 6 }}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.title}>{formatDateTime(h.departure_time)}</Text>
                    <Badge tone={h.bucket === 'completed' ? 'success' : 'neutral'}>
                      {h.bucket}
                    </Badge>
                  </View>
                  <Text style={styles.sub}>
                    {h.origin_name} → {h.destination_name}
                  </Text>
                  <Text style={styles.fare}>{formatPkr(h.fare)}</Text>
                </Card>
              ))
            )}
            <Card onPress={() => navigation.navigate('PaymentHistory')}>
              <Text style={[styles.title, { color: colors.brand }]}>
                View full payment history →
              </Text>
            </Card>
          </>
        )}

        <Button
          variant="secondary"
          icon="Car"
          onPress={() =>
            navigation.navigate(user?.is_driver_verified ? 'DriverRides' : 'BecomeDriver')
          }
        >
          Switch to driver view
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
  tabActive: { backgroundColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  fare: { fontSize: 15, fontWeight: '700', color: colors.brand },
});
