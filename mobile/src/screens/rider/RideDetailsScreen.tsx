import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, ridesApi, type RideRead } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { LiveMap } from '../../components/LiveMap';
import { RoutePointPickerModal } from '../../components/RoutePointPickerModal';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ErrorBanner,
  Footer,
  Icon,
  RouteRow,
  Stars,
  type IconName,
} from '../../components/ui';
import { colors, radii, shadows } from '../../theme';
import { addMinutesIso, formatDateTime, formatPkr, formatTime } from '../../utils/format';
import { estimatePartialFare, projectOnRoute } from '../../utils/geo';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RideDetails'>;

export function RideDetailsScreen({ navigation, route }: Props) {
  const { rideId, ride: initialRide } = route.params;
  const { showToast } = useDialog();

  const [ride, setRide] = useState<RideRead | null>(initialRide ?? null);
  const [loading, setLoading] = useState(!initialRide);
  const [requesting, setRequesting] = useState(false);
  const [fav, setFav] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customPickup, setCustomPickup] = useState<{
    name: string;
    lat: number;
    lng: number;
    progress: number;
  } | null>(null);
  const [customDropoff, setCustomDropoff] = useState<{
    name: string;
    lat: number;
    lng: number;
    progress: number;
  } | null>(null);
  const [pickerMode, setPickerMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [fareOfferText, setFareOfferText] = useState('');
  const [fareTouched, setFareTouched] = useState(false);

  useEffect(() => {
    ridesApi
      .getRide(rideId)
      .then((r) => {
        setRide(r);
        if (!fareTouched) {
          setFareOfferText(String(r.estimated_fare));
        }
      })
      .catch((err) => setError(getApiError(err, 'Could not load ride details.')))
      .finally(() => setLoading(false));
  }, [rideId]);

  const effectiveRoute = useMemo<[number, number][]>(() => {
    if (!ride) return [];
    return ride.route.length >= 2
      ? ride.route
      : [
          [ride.origin_lat, ride.origin_lng],
          [ride.dest_lat, ride.dest_lng],
        ];
  }, [ride]);

  const activePickup = customPickup ?? (ride
    ? { name: ride.origin_name, lat: ride.origin_lat, lng: ride.origin_lng, progress: 0 }
    : null);
  const activeDropoff = customDropoff ?? (ride
    ? { name: ride.destination_name, lat: ride.dest_lat, lng: ride.dest_lng, progress: 1 }
    : null);

  const partialEstimate = useMemo(() => {
    if (!ride || !activePickup || !activeDropoff) return { fare: 0, pct: 100 };
    return estimatePartialFare(ride.estimated_fare, activePickup.progress, activeDropoff.progress);
  }, [ride, activePickup, activeDropoff]);

  useEffect(() => {
    if (ride && !fareTouched) {
      setFareOfferText(String(partialEstimate.fare));
    }
  }, [partialEstimate.fare, ride, fareTouched]);

  const handleRequestSeat = async () => {
    if (!ride || !activePickup || !activeDropoff) return;
    const pickupCheck = projectOnRoute([activePickup.lat, activePickup.lng], effectiveRoute);
    const dropoffCheck = projectOnRoute([activeDropoff.lat, activeDropoff.lng], effectiveRoute);
    if (pickupCheck.distanceM > 500) {
      setError('Pickup point must be within 500m of the driver’s route.');
      return;
    }
    if (dropoffCheck.distanceM > 500) {
      setError('Drop-off point must be within 500m of the driver’s route.');
      return;
    }
    const parsedOffer = fareOfferText.trim() ? Number(fareOfferText.trim()) : undefined;
    if (parsedOffer !== undefined && (!Number.isFinite(parsedOffer) || parsedOffer < 0 || parsedOffer > 10000)) {
      setError('Enter a valid fare offer between PKR 0 and PKR 10,000.');
      return;
    }

    setError(null);
    setRequesting(true);
    try {
      const booking = await bookingsApi.requestSeat({
        ride_id: ride.id,
        pickup_name: activePickup.name,
        pickup_lat: activePickup.lat,
        pickup_lng: activePickup.lng,
        dropoff_name: activeDropoff.name,
        dropoff_lat: activeDropoff.lat,
        dropoff_lng: activeDropoff.lng,
        proposed_fare: parsedOffer,
      });
      navigation.navigate('WaitingForSeats', { bookingId: booking.id, rideId: ride.id });
    } catch (err) {
      setError(getApiError(err, 'Could not request a seat.'));
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !ride || !activePickup || !activeDropoff) {
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
    ['Fair Offer', 'Banknote'],
    ['24/7 SOS', 'Siren'],
  ];

  const offerNum = fareOfferText.trim() ? Number(fareOfferText.trim()) : partialEstimate.fare;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={styles.mapWrap}>
        <LiveMap
          center={{ latitude: ride.origin_lat, longitude: ride.origin_lng }}
          route={effectiveRoute}
          markers={[
            {
              id: 'origin',
              latitude: activePickup.lat,
              longitude: activePickup.lng,
              title: `Pickup: ${activePickup.name}`,
              tone: 'success',
            },
            {
              id: 'dest',
              latitude: activeDropoff.lat,
              longitude: activeDropoff.lng,
              title: `Drop-off: ${activeDropoff.name}`,
              tone: 'brand',
            },
          ]}
        />
        <SafeAreaView edges={['top']} style={styles.mapTopBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
            <Icon name="ChevronLeft" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                Share.share({
                  message: `NED Transport Hub ride: ${ride.origin_name} → ${ride.destination_name} (${formatDateTime(ride.departure_time)}, ${formatPkr(ride.estimated_fare)}/seat)`,
                }).catch(() => {
                  showToast({
                    title: 'Ride route',
                    message: `${ride.origin_name} → ${ride.destination_name}`,
                    tone: 'info',
                  });
                });
              }}
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
              Verified NED driver · {ride.distance_km.toFixed(1)} km full route
            </Text>
          </View>
        </Card>

        <Card style={{ gap: 12 }}>
          <Text style={styles.cardHeading}>Driver route</Text>
          <RouteRow
            from={ride.origin_name}
            to={ride.destination_name}
            a={formatTime(ride.departure_time)}
            b={addMinutesIso(ride.departure_time, ride.duration_min)}
          />
          {ride.notes ? <Text style={styles.notes}>Note: {ride.notes}</Text> : null}
        </Card>

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardHeading}>Your stops (within 500m of route)</Text>
            {partialEstimate.pct < 95 ? (
              <Badge tone="info">{partialEstimate.pct}% of route</Badge>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => setPickerMode('pickup')}
            style={styles.pickupChoice}
          >
            <Icon name="MapPin" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>Your pickup</Text>
              <Text style={styles.pickupName} numberOfLines={1}>
                {activePickup.name}
              </Text>
              <Text style={styles.pickupHint}>Tap to choose any point within 500m of route</Text>
            </View>
            <Icon name="ChevronRight" size={18} color={colors.ink3} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            onPress={() => setPickerMode('dropoff')}
            style={styles.pickupChoice}
          >
            <Icon name="GraduationCap" size={18} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stopLabel}>Your drop-off</Text>
              <Text style={styles.pickupName} numberOfLines={1}>
                {activeDropoff.name}
              </Text>
              <Text style={styles.pickupHint}>Tap to adjust drop-off along the route</Text>
            </View>
            <Icon name="ChevronRight" size={18} color={colors.ink3} />
          </TouchableOpacity>
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardHeading}>Your fare offer (PKR)</Text>
            <Text style={styles.driverFareNote}>Driver listed: {formatPkr(ride.estimated_fare)}</Text>
          </View>
          <Text style={styles.pickupHint}>
            Riding part of the route? Offer a fair fare — the driver can accept, counter, or decline.
          </Text>
          <View style={styles.offerRow}>
            <Text style={styles.pkrPrefix}>PKR</Text>
            <TextInput
              value={fareOfferText}
              onChangeText={(v) => {
                setFareTouched(true);
                setFareOfferText(v.replace(/\D/g, ''));
              }}
              keyboardType="number-pad"
              placeholder={String(partialEstimate.fare)}
              placeholderTextColor={colors.ink3}
              style={styles.offerInput}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {partialEstimate.fare !== ride.estimated_fare ? (
              <Chip
                active={offerNum === partialEstimate.fare}
                onPress={() => {
                  setFareTouched(true);
                  setFareOfferText(String(partialEstimate.fare));
                }}
              >
                Suggested {formatPkr(partialEstimate.fare)} ({partialEstimate.pct}%)
              </Chip>
            ) : null}
            <Chip
              active={offerNum === ride.estimated_fare}
              onPress={() => {
                setFareTouched(true);
                setFareOfferText(String(ride.estimated_fare));
              }}
            >
              Full {formatPkr(ride.estimated_fare)}
            </Chip>
            {ride.estimated_fare >= 60 ? (
              <Chip
                active={offerNum === Math.max(20, Math.round((ride.estimated_fare * 0.5) / 10) * 10)}
                onPress={() => {
                  setFareTouched(true);
                  setFareOfferText(
                    String(Math.max(20, Math.round((ride.estimated_fare * 0.5) / 10) * 10)),
                  );
                }}
              >
                Half route ({formatPkr(Math.max(20, Math.round((ride.estimated_fare * 0.5) / 10) * 10))})
              </Chip>
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <Footer>
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.fromLabel}>Your offer</Text>
            <Text style={styles.priceBig}>
              {formatPkr(offerNum)}{' '}
              <Text style={styles.perSeat}>/ seat</Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              loading={requesting}
              disabled={ride.available_seats < 1 || ride.status !== 'open'}
              onPress={handleRequestSeat}
            >
              Send Request & Offer
            </Button>
          </View>
        </View>
      </Footer>

      <RoutePointPickerModal
        visible={pickerMode !== null}
        title={pickerMode === 'dropoff' ? 'Select drop-off (≤ 500m)' : 'Select pickup (≤ 500m)'}
        subtitle={`${ride.origin_name} → ${ride.destination_name}`}
        route={effectiveRoute}
        origin={{ name: ride.origin_name, lat: ride.origin_lat, lng: ride.origin_lng }}
        destination={{ name: ride.destination_name, lat: ride.dest_lat, lng: ride.dest_lng }}
        initialPoint={pickerMode === 'dropoff' ? activeDropoff : activePickup}
        minProgress={pickerMode === 'dropoff' ? activePickup.progress : 0}
        maxProgress={pickerMode === 'pickup' ? activeDropoff.progress : 1}
        onClose={() => setPickerMode(null)}
        onConfirm={(pt) => {
          if (pickerMode === 'dropoff') {
            setCustomDropoff({ name: pt.name, lat: pt.lat, lng: pt.lng, progress: pt.progress });
          } else {
            setCustomPickup({ name: pt.name, lat: pt.lat, lng: pt.lng, progress: pt.progress });
          }
          setFareTouched(false);
          setPickerMode(null);
        }}
      />
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
    paddingBottom: 28,
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
  driverFareNote: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink2,
  },
  notes: {
    fontSize: 13,
    color: colors.ink2,
    paddingTop: 4,
  },
  stopLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
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
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    height: 48,
  },
  pkrPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  offerInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
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
