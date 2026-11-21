import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, ridesApi, type BookingRead, type RideRead } from '../../api';
import { Button, Card, ErrorBanner, Footer, Icon, RouteRow, Screen, TopBar } from '../../components/ui';
import { colors } from '../../theme';
import { addMinutesIso, formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmed'>;

export function BookingConfirmedScreen({ navigation, route }: Props) {
  const { bookingId, rideId } = route.params;
  const [booking, setBooking] = useState<BookingRead | null>(null);
  const [ride, setRide] = useState<RideRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([bookingsApi.getBooking(bookingId), ridesApi.getRide(rideId)])
      .then(([b, r]) => {
        setBooking(b);
        setRide(r);
      })
      .catch((err) => setError(getApiError(err, 'Could not load booking details.')))
      .finally(() => setLoading(false));
  }, [bookingId, rideId]);

  if (loading || !booking || !ride) {
    return (
      <Screen>
        <TopBar title="Booking confirmed" onBack={() => navigation.goBack()} />
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar
          title="Seat Confirmed"
          onBack={() => navigation.navigate('MainTabs', { screen: 'MyRidesTab' })}
        />
        <View style={styles.content}>
          <ErrorBanner message={error} />

          <View style={styles.hero}>
            <View style={styles.checkCircle}>
              <Icon name="Check" size={32} color={colors.success} />
            </View>
            <Text style={styles.title}>Seat Confirmed</Text>
            <Text style={styles.sub}>
              {ride.driver.name} confirmed your seat. Be at your pickup point 5 minutes early.
            </Text>
          </View>

          <Card style={{ gap: 14 }}>
            <RouteRow
              from={booking.pickup_name ?? ride.origin_name}
              to={booking.dropoff_name ?? ride.destination_name}
              a={formatTime(ride.departure_time)}
              b={addMinutesIso(ride.departure_time, ride.duration_min)}
            />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{ride.vehicle_model}</Text>
              <Text style={styles.metaValue}>{ride.vehicle_plate ?? 'Confirmed'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Agreed Fare</Text>
              <Text style={[styles.metaValue, { color: colors.brand }]}>
                {formatPkr(booking.proposed_fare ?? ride.estimated_fare)}
              </Text>
            </View>
            {ride.driver_phone ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${ride.driver_phone}`)}
                style={styles.phoneRow}
              >
                <Icon name="Phone" size={16} color={colors.brand} />
                <Text style={styles.phoneText}>Call driver: {ride.driver_phone}</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        </View>
      </Screen>

      <Footer>
        <Button
          icon="Navigation"
          onPress={() =>
            navigation.navigate('ActiveRide', { rideId: ride.id, bookingId: booking.id })
          }
        >
          Track {ride.driver.name.split(' ')[0]} Live
        </Button>
        <Button
          variant="secondary"
          icon="MessageCircle"
          onPress={() =>
            navigation.navigate('Chat', {
              bookingId: booking.id,
              peerName: ride.driver.name,
              subtitle: `${ride.vehicle_model}${ride.vehicle_plate ? ` · ${ride.vehicle_plate}` : ''}`,
            })
          }
        >
          Chat with {ride.driver.name.split(' ')[0]}
        </Button>
        {ride.status === 'open' || ride.status === 'full' ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('CancelBooking', {
                bookingId: booking.id,
                driverName: ride.driver.name,
              })
            }
            style={styles.cancelLink}
          >
            <Text style={styles.cancelText}>Cancel booking</Text>
          </TouchableOpacity>
        ) : null}
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 10,
    gap: 8,
  },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    maxWidth: 300,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  metaLabel: {
    fontSize: 14,
    color: colors.ink2,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
  },
  phoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
});
