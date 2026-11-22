import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, pollsApi } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { Button, Card, ErrorBanner, Icon, Screen, TopBar } from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NoRides'>;

export function NoRidesScreen({ navigation, route }: Props) {
  const { pickup, dropoff } = useRideFlow();
  const { showToast } = useDialog();
  const [seatsNeeded, setSeatsNeeded] = useState(route.params?.seatsNeeded ?? 1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePoll = async () => {
    setError(null);
    setCreating(true);
    try {
      const departure = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      await pollsApi.createPoll({
        origin_name: pickup.name,
        destination_name: dropoff.name,
        origin_lat: pickup.lat,
        origin_lng: pickup.lng,
        dest_lat: dropoff.lat,
        dest_lng: dropoff.lng,
        departure_time: departure,
        seats_needed: seatsNeeded,
        note: `Looking for ${seatsNeeded} seat(s) to campus`,
      });
      showToast({
        title: 'Ride Poll Posted!',
        message: 'Visible under My Rides → My Polls. Drivers will be notified.',
        tone: 'success',
      });
      navigation.navigate('MainTabs', { screen: 'MyRidesTab' });
    } catch (err) {
      setError(getApiError(err, 'Could not post ride poll.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen scroll={false}>
      <TopBar title="Find a ride" onBack={() => navigation.goBack()} />
      <View style={styles.center}>
        <View style={styles.circle}>
          <Icon name="SearchX" size={34} color={colors.brand} />
        </View>
        <Text style={styles.title}>No rides found</Text>
        <Text style={styles.sub}>
          No open rides from {pickup.name} to {dropoff.name}. Post a ride request poll so verified
          NED drivers can offer a trip for you.
        </Text>

        <Card style={styles.seatCard}>
          <Text style={styles.seatLabel}>Seats needed</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              disabled={seatsNeeded <= 1}
              onPress={() => setSeatsNeeded(Math.max(1, seatsNeeded - 1))}
              style={[styles.stepBtnLight, seatsNeeded <= 1 && { opacity: 0.4 }]}
            >
              <Icon name="Minus" size={16} color={colors.brand} />
            </TouchableOpacity>
            <Text style={styles.seatVal}>{seatsNeeded}</Text>
            <TouchableOpacity
              disabled={seatsNeeded >= 4}
              onPress={() => setSeatsNeeded(Math.min(4, seatsNeeded + 1))}
              style={[styles.stepBtnDark, seatsNeeded >= 4 && { opacity: 0.4 }]}
            >
              <Icon name="Plus" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Card>

        <ErrorBanner message={error} />
        <View style={styles.btns}>
          <Button loading={creating} icon="Megaphone" onPress={handleCreatePoll}>
            Post Ride Request Poll
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              navigation.navigate('PickLocation', { target: 'pickup', returnTo: 'SearchResults' })
            }
          >
            Change pickup
          </Button>
          <Button variant="ghost" onPress={() => navigation.navigate('FindRide')}>
            Search again
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, textAlign: 'center', lineHeight: 20 },
  seatCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
  },
  seatLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtnLight: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatVal: { fontSize: 16, fontWeight: '700', color: colors.ink, minWidth: 18, textAlign: 'center' },
  btns: { width: '100%', gap: 10, marginTop: 4 },
});
