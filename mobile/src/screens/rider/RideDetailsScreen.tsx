import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, ridesApi, type RideRead } from '../../api';
import { LiveMap } from '../../components/LiveMap';
import {
  Avatar,
  Button,
  Card,
  ErrorBanner,
  Footer,
  Icon,
  RouteRow,
  Stars,
  type IconName,
} from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii, shadows } from '../../theme';
import { addMinutesIso, formatDateTime, formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RideDetails'>;

export function RideDetailsScreen({ navigation, route }: Props) {
  const { rideId, ride: initialRide } = route.params;
  const { pickup } = useRideFlow();

  const [ride, setRide] = useState<RideRead | null>(initialRide ?? null);
  const [loading, setLoading] = useState(!initialRide);
  const [requesting, setRequesting] = useState(false);
  const [fav, setFav] = useState(false);
  const [useRideOrigin, setUseRideOrigin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ridesApi
      .getRide(rideId)
      .then(setRide)
      .catch((err) => setError(getApiError(err, 'Could not load ride details.')))
      .finally(() => setLoading(false));
  }, [rideId]);

  const handleRequestSeat = async () => {
    if (!ride) return;
    setError(null);
    setRequesting(true);
    try {
      const booking = await bookingsApi.requestSeat({
        ride_id: ride.id,
        pickup_name: useRideOrigin ? ride.origin_name : pickup.name,
        pickup_lat: useRideOrigin ? ride.origin_lat : pickup.lat,
        pickup_lng: useRideOrigin ? ride.origin_lng : pickup.lng,
        dropoff_name: ride.destination_name,
        dropoff_lat: ride.dest_lat,
        dropoff_lng: ride.dest_lng,
      });
      navigation.navigate('WaitingForSeats', { bookingId: booking.id, rideId: ride.id });
    } catch (err) {
      setError(getApiError(err, 'Could not request a seat.'));
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !ride) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} />
        ) : (
          <View style={{ padding: 24, gap: 12 }}>
            <ErrorBanner message={error ?? 'Ride not found'} />
            <Button onPress={() => navigation.goBack()}>Go Back</Button>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const features: [string, IconName][] = [
    ['Verified Driver', 'BadgeCheck'],
    ['Live Tracking', 'MapPin'],
    ['Split Fare', 'Split'],
    ['24/7 SOS', 'Siren'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={styles.mapWrap}>
        <LiveMap
          center={{ latitude: ride.origin_lat, longitude: ride.origin_lng }}
          route={ride.route}
          markers={[
            {
              id: 'origin',
              latitude: ride.origin_lat,
              longitude: ride.origin_lng,
              title: ride.origin_name,
            },
            {
              id: 'dest',
              latitude: ride.dest_lat,
              longitude: ride.dest_lng,
              title: ride.destination_name,
            },
          ]}
        />
        <SafeAreaView edges={['top']} style={styles.mapTopBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
            <Icon name="ChevronLeft" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => Alert.alert('Share Ride', `${ride.origin_name} → ${ride.destination_name}`)}
              style={styles.circleBtn}
            >
              <Icon name="Share2" size={18} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFav(!fav)} style={styles.circleBtn}>
              <Icon
                name="Heart"
                size={18}
                color={fav ? colors.danger : colors.ink}
                fill={fav ? colors.danger : 'none'}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.title}>
            {ride.vehicle_model} · {ride.available_seats} seat{ride.available_seats === 1 ? '' : 's'} left
          </Text>
          <View style={styles.ratingRow}>
            <Stars rating={ride.driver.rating_avg} />
            <Text style={styles.ratingSub}>
              ({ride.driver.rating_count} reviews) · {formatDateTime(ride.departure_time)}
            </Text>
          </View>
        </View>

        <ErrorBanner message={error} />

        <View style={styles.featsGrid}>
          {features.map(([label, icon]) => (
            <View key={label} style={styles.featItem}>
              <Icon name={icon} size={20} color={colors.brand} />
              <Text style={styles.featLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <Card style={styles.driverCard}>
          <Avatar name={ride.driver.name} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{ride.driver.name}</Text>
            <Text style={styles.driverSub}>
              Verified NED driver · {ride.distance_km.toFixed(1)} km trip
            </Text>
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <Text style={styles.cardHeading}>Route overview</Text>
          <RouteRow
            from={ride.origin_name}
            to={ride.destination_name}
            a={formatTime(ride.departure_time)}
            b={addMinutesIso(ride.departure_time, ride.duration_min)}
          />
          {ride.notes ? <Text style={styles.notes}>Note: {ride.notes}</Text> : null}
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.cardHeading}>Pickup point</Text>
          <TouchableOpacity
            onPress={() => setUseRideOrigin(!useRideOrigin)}
            style={styles.pickupChoice}
          >
            <Icon name="MapPin" size={18} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupName}>
                {useRideOrigin ? ride.origin_name : pickup.name}
              </Text>
              <Text style={styles.pickupHint}>
                Tap to switch between driver start point and your pinned pickup
              </Text>
            </View>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      <Footer>
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.fromLabel}>Estimated fare</Text>
            <Text style={styles.priceBig}>
              {formatPkr(ride.estimated_fare)}{' '}
              <Text style={styles.perSeat}>/ seat</Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              loading={requesting}
              disabled={ride.available_seats < 1 || ride.status !== 'open'}
              onPress={handleRequestSeat}
            >
              Request Seat
            </Button>
          </View>
        </View>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  mapWrap: {
    height: 230,
    position: 'relative',
  },
  mapTopBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sheetScroll: {
    flex: 1,
    marginTop: -22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.canvas,
  },
  sheetContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ratingSub: {
    fontSize: 13,
    color: colors.ink2,
  },
  featsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  featItem: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    ...shadows.card,
  },
  featLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
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
    fontSize: 12,
    color: colors.ink2,
    marginTop: 2,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  notes: {
    fontSize: 13,
    color: colors.ink2,
    paddingTop: 4,
  },
  pickupChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickupName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  pickupHint: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fromLabel: {
    fontSize: 11,
    color: colors.ink3,
  },
  priceBig: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  perSeat: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.ink3,
  },
});
