import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, ridesApi, type BookingRead, type RideRead } from '../../api';
import { Avatar, Badge, Button, Card, ErrorBanner, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WaitingForSeats'>;

export function WaitingForSeatsScreen({ navigation, route }: Props) {
  const { bookingId, rideId } = route.params;
  const [booking, setBooking] = useState<BookingRead | null>(null);
  const [ride, setRide] = useState<RideRead | null>(null);
  const [waitFull, setWaitFull] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([
        bookingsApi.getBooking(bookingId),
        ridesApi.getRide(rideId),
      ]);
      setBooking(b);
      setRide(r);
      if (b.status === 'confirmed') {
        navigation.replace('BookingConfirmed', { bookingId: b.id, rideId: b.ride_id });
      }
    } catch (err) {
      setError(getApiError(err, 'Could not refresh booking status.'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, rideId, navigation]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !booking || !ride) {
    return (
      <Screen>
        <TopBar title="Your booking" onBack={() => navigation.goBack()} />
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const booked = ride.total_seats - ride.available_seats;
  const fareProposed = booking.status === 'pending' && booking.fare_status === 'proposed';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Your booking" onBack={() => navigation.navigate('MainTabs', { screen: 'MyRidesTab' })} />
        <View style={styles.content}>
          <ErrorBanner message={error} />

          <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.banner}>
            <Text style={styles.bannerLabel}>
              {fareProposed ? 'Fare proposed by driver!' : 'Awaiting driver response'}
            </Text>
            <Text style={styles.bannerBig}>
              {booked} of {ride.total_seats} seats booked
            </Text>

            <View style={styles.seatsRow}>
              {Array.from({ length: ride.total_seats }).map((_, i) => (
                <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                  {i < booked ? (
                    <Avatar name={i === 0 ? 'You' : `R${i + 1}`} size={44} tone={i === 0 ? 'brand' : 'accent'} />
                  ) : (
                    <View style={styles.openSeat}>
                      <Icon name="Plus" size={18} color={colors.white} />
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.progressTrack}>
              {Array.from({ length: ride.total_seats }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSeg,
                    { backgroundColor: i < booked ? colors.accent : 'rgba(255,255,255,0.22)' },
                  ]}
                />
              ))}
            </View>
          </LinearGradient>

          {fareProposed ? (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Proposed Fare</Text>
                <Badge tone="info">{formatPkr(booking.proposed_fare)}</Badge>
              </View>
              <Text style={styles.subText}>
                {ride.driver.name} accepted your request and proposed {formatPkr(booking.proposed_fare)}.
              </Text>
              <Button
                icon="Check"
                onPress={() =>
                  navigation.navigate('FareReview', { bookingId: booking.id, booking, ride })
                }
              >
                Review & Accept Fare
              </Button>
            </Card>
          ) : null}

          <Text style={styles.sectionTitle}>When should the ride leave?</Text>
          {[
            [
              true,
              'Wait until all seats are full',
              'Leaves when the last seat is booked, latest by departure time',
            ],
            [
              false,
              `Leave at ${formatTime(ride.departure_time)} as scheduled`,
              'Go on time, even with empty seats',
            ],
          ].map(([val, title, desc]) => {
            const active = waitFull === val;
            return (
              <TouchableOpacity
                key={String(title)}
                activeOpacity={0.85}
                onPress={() => setWaitFull(val as boolean)}
                style={[styles.optionCard, active && styles.optionCardActive]}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{title as string}</Text>
                  <Text style={styles.optionDesc}>{desc as string}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.hintRow}>
            <Icon name="Clock" size={16} color={colors.accentBright} />
            <Text style={styles.hintText}>
              We automatically refresh your booking status every few seconds.
            </Text>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button variant="secondary" icon="RefreshCw" onPress={load}>
          Refresh Status
        </Button>
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
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  banner: {
    borderRadius: radii.xxl,
    padding: 22,
  },
  bannerLabel: {
    fontSize: 13,
    color: colors.accent,
  },
  bannerBig: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    marginTop: 4,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  openSeat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  progressSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  subText: {
    fontSize: 13,
    color: colors.ink2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  optionCardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.brand,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  optionDesc: {
    fontSize: 12,
    color: colors.ink2,
    marginTop: 2,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: colors.ink2,
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
