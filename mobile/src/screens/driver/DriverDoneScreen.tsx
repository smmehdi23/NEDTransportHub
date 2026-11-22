import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  bookingsApi,
  getApiError,
  paymentsApi,
  ridesApi,
  type BookingRead,
  type PaymentRead,
  type RideRead,
} from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { Badge, Button, Card, ErrorBanner, Footer, Icon, Screen } from '../../components/ui';
import { colors } from '../../theme';
import { formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDone'>;

export function DriverDoneScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const { showToast } = useDialog();
  const [ride, setRide] = useState<RideRead | null>(null);
  const [bookings, setBookings] = useState<BookingRead[]>([]);
  const [payments, setPayments] = useState<Record<number, PaymentRead>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, bList] = await Promise.all([
        ridesApi.getRide(rideId),
        bookingsApi.listBookings({ as_driver: true, ride_id: rideId }),
      ]);
      setRide(r);
      const completed = bList.filter((b) => b.status === 'completed');
      setBookings(completed);
      const payMap: Record<number, PaymentRead> = {};
      await Promise.all(
        completed.map(async (b) => {
          const p = await paymentsApi.getBookingPayment(b.id).catch(() => null);
          if (p) payMap[b.id] = p;
        }),
      );
      setPayments(payMap);
    } catch (err) {
      setError(getApiError(err, 'Could not load ride summary.'));
    }
  }, [rideId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmCash = async (bookingId: number) => {
    try {
      await paymentsApi.confirmCash(bookingId);
      showToast({
        title: 'Cash confirmed',
        message: 'Payment marked as received.',
        tone: 'success',
      });
      load();
    } catch (err) {
      setError(getApiError(err, 'Could not confirm cash payment.'));
    }
  };

  const totalShared = Object.values(payments).reduce((acc, p) => acc + p.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <View style={styles.content}>
          <View style={styles.circle}>
            <Icon name="Check" size={38} color={colors.success} />
          </View>
          <Text style={styles.title}>Ride completed</Text>
          <Text style={styles.sub}>
            You dropped {bookings.length} rider(s) at {ride?.destination_name ?? 'NED University'}.
          </Text>

          <ErrorBanner message={error} />

          <Card style={{ width: '100%', gap: 10 }}>
            <Text style={styles.cardHeading}>Trip summary</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Fuel cost shared</Text>
              <Text style={styles.val}>{formatPkr(totalShared)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Distance</Text>
              <Text style={styles.val}>{ride ? `${ride.distance_km.toFixed(1)} km` : '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Estimated duration</Text>
              <Text style={styles.val}>{ride ? `${Math.round(ride.duration_min)} min` : '—'}</Text>
            </View>
          </Card>

          {bookings.length > 0 ? (
            <Card style={{ width: '100%', gap: 12 }}>
              <Text style={styles.cardHeading}>Rider payments</Text>
              {bookings.map((b) => {
                const pay = payments[b.id];
                const canConfirmCash = pay?.method === 'cash' && pay.status === 'pending';
                return (
                  <View key={b.id} style={styles.payRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.val}>{b.passenger.name}</Text>
                      <Text style={styles.label}>
                        {formatPkr(pay?.amount ?? b.proposed_fare)} · {pay?.method ?? 'unpaid'}
                      </Text>
                    </View>
                    {canConfirmCash ? (
                      <Button small onPress={() => handleConfirmCash(b.id)}>
                        Confirm Cash
                      </Button>
                    ) : (
                      <Badge tone={pay?.status === 'successful' ? 'success' : 'warning'}>
                        {pay?.status ?? 'pending'}
                      </Badge>
                    )}
                  </View>
                );
              })}
            </Card>
          ) : null}

          <View style={{ width: '100%' }}>
            <Button
              variant="secondary"
              onPress={() => navigation.navigate('RateRide', { rideId })}
            >
              Rate your riders
            </Button>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}>
          Back to Home
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 32, alignItems: 'center', gap: 14 },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, textAlign: 'center' },
  cardHeading: { fontSize: 15, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 13, color: colors.ink2 },
  val: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
