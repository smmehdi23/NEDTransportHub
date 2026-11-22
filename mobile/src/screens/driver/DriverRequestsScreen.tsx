import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  bookingsApi,
  getApiError,
  ridesApi,
  type BookingRead,
  type RideRead,
} from '../../api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorBanner,
  Footer,
  Screen,
  TopBar,
} from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverRequests'>;

export function DriverRequestsScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const [ride, setRide] = useState<RideRead | null>(null);
  const [bookings, setBookings] = useState<BookingRead[]>([]);
  const [fareOverrides, setFareOverrides] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, list] = await Promise.all([
        ridesApi.getRide(rideId),
        bookingsApi.listBookings({ as_driver: true, ride_id: rideId }),
      ]);
      setRide(r);
      setBookings(list);
    } catch (err) {
      setError(getApiError(err, 'Could not load ride requests.'));
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRespond = async (
    booking: BookingRead,
    action: 'accept' | 'reject',
    explicitFare?: number,
  ) => {
    setError(null);
    setBusyId(booking.id);
    try {
      const rawFare = fareOverrides[booking.id];
      const parsedFare =
        explicitFare ?? (rawFare ? Number(rawFare) : booking.proposed_fare ?? ride?.estimated_fare);
      await bookingsApi.respondToBooking(booking.id, {
        action,
        fare: action === 'accept' ? parsedFare : undefined,
        reason: action === 'reject' ? 'Driver declined request' : undefined,
      });
      await load();
    } catch (err) {
      setError(getApiError(err, 'Could not update request.'));
    } finally {
      setBusyId(null);
    }
  };

  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Ride requests" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <ErrorBanner message={error} />
          {loading || !ride ? (
            <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
          ) : (
            <>
              <View>
                <Text style={styles.headTitle}>
                  {formatDateTime(ride.departure_time)} · {ride.available_seats} seats left
                </Text>
                <Text style={styles.headSub}>
                  {ride.origin_name} → {ride.destination_name}
                </Text>
              </View>

              {bookings.length === 0 ? (
                <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                  <Text style={styles.headSub}>No seat requests for this ride yet.</Text>
                </Card>
              ) : (
                bookings.map((b) => {
                  const riderOffer = b.fare_status === 'none' ? b.proposed_fare : null;
                  const fareVal =
                    fareOverrides[b.id] ?? String(b.proposed_fare ?? ride.estimated_fare);
                  const numericFare = Number(fareVal || 0);
                  const isAcceptingRiderOffer =
                    riderOffer !== null && numericFare === riderOffer;
                  const canRespond = b.status === 'pending' && b.fare_status !== 'proposed';
                  return (
                    <Card key={b.id} style={{ gap: 12 }}>
                      <View style={styles.row}>
                        <Avatar name={b.passenger.name} size={42} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{b.passenger.name}</Text>
                          <Text style={styles.sub}>
                            {b.pickup_name
                              ? `Pickup: ${b.pickup_name}`
                              : 'Pickup pin revealed after confirmation'}
                          </Text>
                        </View>
                        <Badge
                          tone={
                            b.status === 'confirmed'
                              ? 'success'
                              : b.status === 'rejected' || b.status === 'cancelled'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {b.status === 'pending' && b.fare_status === 'proposed'
                            ? 'Counter sent'
                            : b.status}
                        </Badge>
                      </View>

                      {canRespond && riderOffer !== null ? (
                        <View style={styles.offerBanner}>
                          <Text style={styles.offerText}>
                            Rider offered{' '}
                            <Text style={{ fontWeight: '800', color: colors.brand }}>
                              {formatPkr(riderOffer)}
                            </Text>
                            {riderOffer < ride.estimated_fare
                              ? ` (your full route: ${formatPkr(ride.estimated_fare)})`
                              : ''}
                          </Text>
                        </View>
                      ) : null}

                      {canRespond ? (
                        <>
                          <View style={styles.fareRow}>
                            <Text style={styles.fareLabel}>
                              {riderOffer !== null ? 'Accept or counter (PKR)' : 'Propose fare (PKR)'}
                            </Text>
                            <TextInput
                              value={fareVal}
                              onChangeText={(v) =>
                                setFareOverrides((prev) => ({
                                  ...prev,
                                  [b.id]: v.replace(/\D/g, ''),
                                }))
                              }
                              keyboardType="number-pad"
                              style={styles.fareInput}
                            />
                          </View>
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Button
                              small
                              variant="secondary"
                              loading={busyId === b.id}
                              onPress={() => handleRespond(b, 'reject')}
                              style={{ flex: 1 }}
                            >
                              Decline
                            </Button>
                            <Button
                              small
                              loading={busyId === b.id}
                              onPress={() => handleRespond(b, 'accept', numericFare)}
                              style={{ flex: 1 }}
                            >
                              {isAcceptingRiderOffer
                                ? `Accept ${formatPkr(riderOffer)}`
                                : riderOffer !== null
                                ? `Counter ${formatPkr(numericFare)}`
                                : 'Accept & Propose'}
                            </Button>
                          </View>
                        </>
                      ) : b.status === 'confirmed' ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.confirmedMeta}>
                            Agreed: {formatPkr(b.proposed_fare)}
                          </Text>
                          <Button
                            small
                            variant="secondary"
                            icon="MessageCircle"
                            onPress={() =>
                              navigation.navigate('Chat', {
                                bookingId: b.id,
                                peerName: b.passenger.name,
                                subtitle: b.pickup_name ?? 'Confirmed rider',
                              })
                            }
                          >
                            Chat
                          </Button>
                        </View>
                      ) : b.fare_status === 'proposed' ? (
                        <Text style={styles.sub}>
                          Proposed {formatPkr(b.proposed_fare)} — waiting for rider to accept.
                        </Text>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </>
          )}
        </View>
      </Screen>

      <Footer>
        <Button
          disabled={confirmedCount < 1}
          onPress={() => navigation.navigate('DriverStart', { rideId })}
        >
          {confirmedCount > 0
            ? `Continue to Start Ride (${confirmedCount} confirmed)`
            : 'Confirm at least 1 rider to start'}
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  headTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  headSub: { fontSize: 13, color: colors.ink2, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fareLabel: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  fareInput: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 84,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  confirmedMeta: { fontSize: 13, fontWeight: '700', color: colors.success },
  offerBanner: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offerText: { fontSize: 13, color: colors.ink },
});
