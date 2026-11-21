import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, ridesApi, type BookingRead, type RideRead } from '../../api';
import { Avatar, Button, Card, ErrorBanner, Footer, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FareReview'>;

export function FareReviewScreen({ navigation, route }: Props) {
  const { bookingId, booking: initialBooking, ride: initialRide } = route.params;
  const [booking, setBooking] = useState<BookingRead | null>(initialBooking ?? null);
  const [ride, setRide] = useState<RideRead | null>(initialRide ?? null);
  const [loading, setLoading] = useState(!initialBooking);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const b = await bookingsApi.getBooking(bookingId);
        if (!active) return;
        setBooking(b);
        const r = await ridesApi.getRide(b.ride_id);
        if (active) setRide(r);
      } catch (err) {
        if (active) setError(getApiError(err, 'Could not load fare details.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  const handleDecision = async (accept: boolean) => {
    if (!booking) return;
    setError(null);
    setSubmitting(true);
    try {
      const updated = await bookingsApi.decideFare(booking.id, accept);
      if (accept) {
        navigation.replace('BookingConfirmed', {
          bookingId: updated.id,
          rideId: updated.ride_id,
        });
      } else {
        Alert.alert('Fare declined', 'The driver has been notified and may propose another fare.');
        navigation.goBack();
      }
    } catch (err) {
      setError(getApiError(err, 'Could not submit decision.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !booking) {
    return (
      <Screen>
        <TopBar title="Review fare" onBack={() => navigation.goBack()} />
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const fare = booking.proposed_fare ?? ride?.estimated_fare ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Review fare" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <ErrorBanner message={error} />

          <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.fareBanner}>
            <Text style={styles.bannerLabel}>
              {ride?.driver.name ?? 'Driver'} proposed
            </Text>
            <Text style={styles.bannerAmount}>{formatPkr(fare)}</Text>
            <Text style={styles.bannerSub}>
              per seat · {booking.origin_name} → {booking.destination_name}
            </Text>
          </LinearGradient>

          <Card style={{ gap: 12 }}>
            <Text style={styles.cardHeading}>Fare breakdown</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Fuel share</Text>
              <Text style={styles.rowValue}>{formatPkr(fare)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Platform fee</Text>
              <Text style={styles.rowValue}>PKR 0</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalText}>Total</Text>
              <Text style={styles.totalText}>{formatPkr(fare)}</Text>
            </View>
          </Card>

          <Card style={styles.driverCard}>
            <Avatar name={ride?.driver.name ?? 'Driver'} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>Ride with {ride?.driver.name ?? 'Driver'}</Text>
              <Text style={styles.driverSub}>
                {formatDateTime(booking.departure_time)} · {ride?.vehicle_model ?? 'Vehicle'}
              </Text>
            </View>
          </Card>
        </View>
      </Screen>

      <Footer>
        <Button icon="Check" loading={submitting} onPress={() => handleDecision(true)}>
          Accept fare & confirm seat
        </Button>
        <TouchableOpacity
          disabled={submitting}
          onPress={() => handleDecision(false)}
          style={styles.declineBtn}
        >
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  fareBanner: {
    borderRadius: radii.xxl,
    padding: 24,
  },
  bannerLabel: {
    fontSize: 13,
    color: colors.accent,
  },
  bannerAmount: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.white,
    marginTop: 4,
  },
  bannerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 14,
    color: colors.ink2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  totalText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  driverSub: {
    fontSize: 13,
    color: colors.ink2,
    marginTop: 2,
  },
  declineBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  declineText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink2,
  },
});
