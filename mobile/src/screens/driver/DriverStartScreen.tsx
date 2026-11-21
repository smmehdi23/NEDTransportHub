import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  Icon,
  Screen,
  Toggle,
  TopBar,
} from '../../components/ui';
import { colors } from '../../theme';
import { formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverStart'>;

export function DriverStartScreen({ navigation, route }: Props) {
  const { rideId } = route.params;
  const [ride, setRide] = useState<RideRead | null>(null);
  const [confirmed, setConfirmed] = useState<BookingRead[]>([]);
  const [shareLive, setShareLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      ridesApi.getRide(rideId),
      bookingsApi.listBookings({ as_driver: true, ride_id: rideId, status: 'confirmed' }),
    ])
      .then(([r, list]) => {
        setRide(r);
        setConfirmed(list);
      })
      .catch((err) => setError(getApiError(err, 'Could not load ride info.')))
      .finally(() => setLoading(false));
  }, [rideId]);

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      await ridesApi.startRide(rideId);
      navigation.replace('DriverActive', { rideId });
    } catch (err) {
      setError(getApiError(err, 'Could not start ride.'));
    } finally {
      setStarting(false);
    }
  };

  if (loading || !ride) {
    return (
      <Screen>
        <TopBar title="Start ride" onBack={() => navigation.goBack()} />
        <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Start ride" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <ErrorBanner message={error} />

          <Card style={styles.rowBetween}>
            <View>
              <Text style={styles.bold}>
                {confirmed.length} of {ride.total_seats} seats booked
              </Text>
              <Text style={styles.sub}>
                {ride.available_seats === 0 ? 'Car is full' : `${ride.available_seats} open seats`}
              </Text>
            </View>
            <Badge tone={ride.available_seats === 0 ? 'success' : 'info'}>
              {ride.available_seats === 0 ? 'Full' : 'Ready'}
            </Badge>
          </Card>

          <Card style={{ gap: 14 }}>
            <Text style={styles.bold}>Confirmed riders</Text>
            {confirmed.map((b) => (
              <View key={b.id} style={styles.passengerRow}>
                <Avatar name={b.passenger.name} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{b.passenger.name}</Text>
                  <Text style={styles.sub}>
                    Pickup: {b.pickup_name ?? ride.origin_name}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card style={styles.passengerRow}>
            <Icon name="Radio" size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pName}>Share live location</Text>
              <Text style={styles.sub}>Riders see your car live on the map until drop-off</Text>
            </View>
            <Toggle value={shareLive} onValueChange={setShareLive} />
          </Card>

          <Text style={styles.note}>
            Visible to {confirmed.length} confirmed rider(s) and NED campus security in emergencies.
          </Text>
        </View>
      </Screen>

      <Footer>
        <Button icon="Play" loading={starting} onPress={handleStart}>
          Start Ride
        </Button>
        <Text style={styles.footerHint}>Scheduled departure: {formatTime(ride.departure_time)}</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bold: { fontSize: 15, fontWeight: '700', color: colors.ink },
  pName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  note: { fontSize: 12, color: colors.ink2 },
  footerHint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
