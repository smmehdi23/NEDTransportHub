import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, pollsApi } from '../../api';
import { Button, ErrorBanner, Icon, Screen, TopBar } from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NoRides'>;

export function NoRidesScreen({ navigation }: Props) {
  const { pickup, dropoff } = useRideFlow();
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
        seats_needed: 1,
        note: 'Looking for a campus carpool ride',
      });
      Alert.alert(
        'Ride Poll Posted!',
        'Drivers heading on your route will be notified when they offer a matching ride.',
      );
      navigation.navigate('MainTabs', { screen: 'HomeTab' });
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
          We could not find an open ride from {pickup.name} to {dropoff.name}. Post a ride poll so
          verified NED drivers can offer a trip for you!
        </Text>
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 20,
  },
  btns: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
});
