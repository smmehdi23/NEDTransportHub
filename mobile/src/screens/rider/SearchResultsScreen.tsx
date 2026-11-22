import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, ridesApi, type RideMatchRead } from '../../api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ErrorBanner,
  Icon,
  RouteRow,
  Screen,
  Stars,
  TopBar,
} from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import { addMinutesIso, formatDateShort, formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SearchResults'>;

export function SearchResultsScreen({ navigation, route }: Props) {
  const { pickup, dropoff } = useRideFlow();
  const params = route.params;

  const [sort, setSort] = useState<'best' | 'time' | 'fare'>('best');
  const [minSeats, setMinSeats] = useState(1);
  const [matches, setMatches] = useState<RideMatchRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRides = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pLat = params?.pickupLat ?? pickup.lat;
      const pLng = params?.pickupLng ?? pickup.lng;
      const dLat = params?.dropoffLat ?? dropoff.lat;
      const dLng = params?.dropoffLng ?? dropoff.lng;

      let res = await ridesApi.searchRides({
        pickup_lat: pLat,
        pickup_lng: pLng,
        dropoff_lat: dLat,
        dropoff_lng: dLng,
        radius_m: 3000,
        min_seats: minSeats,
        sort,
      });

      if (res.length === 0) {
        const page = await ridesApi.browseRides({
          origin: params?.query,
          page_size: 20,
        });
        res = page.items
          .filter((r) => r.available_seats >= minSeats)
          .map((ride) => ({
            ride,
            pickup_distance_m: 0,
            dropoff_distance_m: null,
            time_diff_min: 0,
            score: 1,
          }));
        if (sort === 'fare') {
          res.sort((a, b) => a.ride.estimated_fare - b.ride.estimated_fare);
        }
      }

      setMatches(res);
    } catch (err) {
      setError(getApiError(err, 'Could not load rides.'));
    } finally {
      setLoading(false);
    }
  }, [params, pickup, dropoff, minSeats, sort]);

  useEffect(() => {
    loadRides();
  }, [loadRides]);

  return (
    <Screen>
      <TopBar
        title="Search results"
        onBack={() => navigation.goBack()}
        right={
          matches.length > 0 ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('ResultsMap', { matches })}
              style={styles.mapBtn}
            >
              <Icon name="Map" size={18} color={colors.brand} />
            </TouchableOpacity>
          ) : null
        }
      />
      <View style={styles.content}>
        <Text style={styles.meta}>
          {params?.pickupName ?? pickup.name} → {params?.dropoffName ?? dropoff.name}
        </Text>

        <View style={styles.seatsBar}>
          <Text style={styles.seatsLabel}>Seats needed</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              disabled={minSeats <= 1}
              onPress={() => setMinSeats(Math.max(1, minSeats - 1))}
              style={[styles.stepBtnLight, minSeats <= 1 && { opacity: 0.4 }]}
            >
              <Icon name="Minus" size={15} color={colors.brand} />
            </TouchableOpacity>
            <Text style={styles.seatVal}>{minSeats}</Text>
            <TouchableOpacity
              disabled={minSeats >= 4}
              onPress={() => setMinSeats(Math.min(4, minSeats + 1))}
              style={[styles.stepBtnDark, minSeats >= 4 && { opacity: 0.4 }]}
            >
              <Icon name="Plus" size={15} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip active={sort === 'best'} onPress={() => setSort('best')}>
            Best match
          </Chip>
          <Chip active={sort === 'time'} onPress={() => setSort('time')}>
            Earliest
          </Chip>
          <Chip active={sort === 'fare'} onPress={() => setSort('fare')}>
            Lowest fare
          </Chip>
        </ScrollView>

        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
        ) : matches.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
            <Icon name="SearchX" size={36} color={colors.brand} />
            <Text style={styles.emptyTitle}>No matching rides found</Text>
            <Text style={styles.emptySub}>
              No open rides with {minSeats} seat{minSeats === 1 ? '' : 's'} right now. Post a ride
              poll so verified NED drivers see your request.
            </Text>
            <Button
              onPress={() =>
                navigation.navigate('NoRides', {
                  pickupName: params?.pickupName ?? pickup.name,
                  dropoffName: params?.dropoffName ?? dropoff.name,
                  seatsNeeded: minSeats,
                })
              }
            >
              Create Ride Request Poll
            </Button>
          </Card>
        ) : (
          <>
            <Text style={styles.count}>{matches.length} rides available</Text>
            {matches.map(({ ride, pickup_distance_m }) => (
              <Card
                key={ride.id}
                onPress={() => navigation.navigate('RideDetails', { rideId: ride.id, ride })}
                style={{ gap: 12 }}
              >
                <View style={styles.driverRow}>
                  <Avatar name={ride.driver.name} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{ride.driver.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <Stars rating={ride.driver.rating_avg} />
                      <Text style={styles.smallMuted}>
                        {ride.driver.rating_count} reviews · {formatDateShort(ride.departure_time)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.fareText}>{formatPkr(ride.estimated_fare)}</Text>
                    <Text style={styles.smallMuted}>per seat</Text>
                  </View>
                </View>

                <RouteRow
                  from={ride.origin_name}
                  to={ride.destination_name}
                  a={formatTime(ride.departure_time)}
                  b={addMinutesIso(ride.departure_time, ride.duration_min)}
                />

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Badge tone="warning">
                    {ride.available_seats} seat{ride.available_seats === 1 ? '' : 's'} left
                  </Badge>
                  <Badge>{ride.vehicle_model}</Badge>
                  {pickup_distance_m > 0 ? (
                    <Badge tone="info">{Math.round(pickup_distance_m)}m away</Badge>
                  ) : null}
                </View>
              </Card>
            ))}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  mapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontSize: 13, color: colors.ink2 },
  seatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  seatsLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtnLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatVal: { fontSize: 16, fontWeight: '700', color: colors.ink, minWidth: 18, textAlign: 'center' },
  count: { fontSize: 15, fontWeight: '700', color: colors.ink },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  fareText: { fontSize: 16, fontWeight: '700', color: colors.brand },
  smallMuted: { fontSize: 12, color: colors.ink3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptySub: { fontSize: 13, color: colors.ink2, textAlign: 'center' },
});
