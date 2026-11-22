import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  driversApi,
  getApiError,
  mapsApi,
  ridesApi,
  type FareEstimate,
  type VehicleRead,
} from '../../api';
import { useDialog } from '../../components/DialogProvider';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorBanner,
  Field,
  Footer,
  Icon,
  Screen,
  TopBar,
} from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OfferRide'>;

const MAX_DEPARTURE_MINUTES = 16 * 60; // 16 hours max
const MIN_DEPARTURE_MINUTES = 5; // 5 minutes min

export function OfferRideScreen({ navigation, route }: Props) {
  const params = route.params;
  const { pickup, dropoff, setPickup, setDropoff } = useRideFlow();
  const { showToast } = useDialog();

  const [vehicles, setVehicles] = useState<VehicleRead[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [seats, setSeats] = useState(3);
  const [offsetMinutes, setOffsetMinutes] = useState(60); // default 1 hr, customizable 5 min..16 hr
  const [fareText, setFareText] = useState('');
  const [notes, setNotes] = useState('');
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clampMinutes = (total: number) =>
    Math.max(MIN_DEPARTURE_MINUTES, Math.min(MAX_DEPARTURE_MINUTES, total));
  const depHours = Math.floor(offsetMinutes / 60);
  const depMins = offsetMinutes % 60;
  const departurePreviewIso = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();

  const adjustHours = (delta: number) => {
    const nextH = Math.max(0, Math.min(16, depHours + delta));
    const nextM = nextH === 16 ? 0 : nextH === 0 && depMins < 5 ? 5 : depMins;
    setOffsetMinutes(clampMinutes(nextH * 60 + nextM));
  };

  const adjustMins = (delta: number) => {
    setOffsetMinutes(clampMinutes(offsetMinutes + delta));
  };

  useEffect(() => {
    if (params?.originName && params.originLat && params.originLng) {
      setPickup({ name: params.originName, lat: params.originLat, lng: params.originLng });
    }
    if (params?.destName && params.destLat && params.destLng) {
      setDropoff({ name: params.destName, lat: params.destLat, lng: params.destLng });
    }
  }, [params, setPickup, setDropoff]);

  useEffect(() => {
    driversApi
      .getMyVehicles()
      .then((list) => {
        const verified = list.filter((v) => v.verification_status === 'verified');
        setVehicles(verified);
        if (verified[0]) {
          setSelectedVehicleId(verified[0].id);
          const isBike = verified[0].model.toLowerCase().startsWith('bike');
          setSeats(isBike ? 1 : Math.min(3, verified[0].seat_capacity));
        }
      })
      .catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    mapsApi
      .getFareEstimate({
        origin_lat: pickup.lat,
        origin_lng: pickup.lng,
        dest_lat: dropoff.lat,
        dest_lng: dropoff.lng,
        passengers: seats,
      })
      .then((est) => {
        setEstimate(est);
        if (!fareText) setFareText(String(est.fare_per_passenger));
      })
      .catch(() => null);
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, seats]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const isBikeSelected = selectedVehicle?.model.toLowerCase().startsWith('bike') ?? false;
  const maxSeats = isBikeSelected ? 1 : Math.min(selectedVehicle?.seat_capacity ?? 4, 6);

  const handlePublish = async () => {
    if (!selectedVehicleId) {
      setError('You need a verified vehicle before publishing a ride.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const departureIso = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
      const parsedFare = fareText.trim() ? Number(fareText.trim()) : undefined;
      await ridesApi.createRide({
        vehicle_id: selectedVehicleId,
        poll_id: params?.pollId ?? undefined,
        origin_name: pickup.name,
        destination_name: dropoff.name,
        origin_lat: pickup.lat,
        origin_lng: pickup.lng,
        dest_lat: dropoff.lat,
        dest_lng: dropoff.lng,
        departure_time: departureIso,
        total_seats: seats,
        estimated_fare: Number.isFinite(parsedFare) ? parsedFare : undefined,
        notes: notes.trim() || undefined,
      });
      showToast({
        title: 'Ride Published!',
        message: 'NED riders along your route can now find and book seats.',
        tone: 'success',
      });
      navigation.replace('DriverRides');
    } catch (err) {
      setError(getApiError(err, 'Could not publish ride.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Offer a ride" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <ErrorBanner message={error} />

          {vehicles.length === 0 ? (
            <Card style={{ backgroundColor: colors.warningSubtle, gap: 10 }}>
              <Badge tone="warning">No verified vehicle</Badge>
              <Text style={styles.warnText}>
                You must have an admin-verified vehicle to publish a ride.
              </Text>
              <Button small onPress={() => navigation.navigate('DriverStatus')}>
                Check Verification Status
              </Button>
            </Card>
          ) : (
            <Card style={{ gap: 8 }}>
              <Text style={styles.label}>Vehicle</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {vehicles.map((v) => (
                  <Chip
                    key={v.id}
                    active={v.id === selectedVehicleId}
                    onPress={() => {
                      setSelectedVehicleId(v.id);
                      const bike = v.model.toLowerCase().startsWith('bike');
                      setSeats(bike ? 1 : Math.min(seats, v.seat_capacity));
                    }}
                  >
                    {v.model} ({v.plate_number})
                  </Chip>
                ))}
              </View>
            </Card>
          )}

          <Card style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('PickLocation', { target: 'pickup', returnTo: 'OfferRide' })
              }
              style={styles.locRow}
            >
              <Icon name="MapPin" size={18} color={colors.accentBright} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>From</Text>
                <Text style={styles.locVal} numberOfLines={1}>
                  {pickup.name}
                </Text>
              </View>
              <Icon name="ChevronRight" size={18} color={colors.ink3} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('PickLocation', { target: 'dropoff', returnTo: 'OfferRide' })
              }
              style={styles.locRow}
            >
              <Icon name="GraduationCap" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>To</Text>
                <Text style={styles.locVal} numberOfLines={1}>
                  {dropoff.name}
                </Text>
              </View>
              <Icon name="ChevronRight" size={18} color={colors.ink3} />
            </TouchableOpacity>
          </Card>

          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>Departure time (max 16 hrs)</Text>
              <Badge tone="info">{formatDateTime(departurePreviewIso)}</Badge>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                [15, '15 min'],
                [30, '30 min'],
                [60, '1 hr'],
                [120, '2 hrs'],
                [240, '4 hrs'],
                [480, '8 hrs'],
                [960, '16 hrs'],
              ].map(([mins, lbl]) => (
                <Chip
                  key={String(mins)}
                  active={offsetMinutes === mins}
                  onPress={() => setOffsetMinutes(mins as number)}
                >
                  {lbl as string}
                </Chip>
              ))}
            </ScrollView>

            <View style={styles.timeGrid}>
              <View style={styles.timeStepperBox}>
                <Text style={styles.timeUnit}>Hours (0–16)</Text>
                <View style={styles.timeStepper}>
                  <TouchableOpacity
                    disabled={depHours <= 0}
                    onPress={() => adjustHours(-1)}
                    style={[styles.stepBtnLight, depHours <= 0 && { opacity: 0.4 }]}
                  >
                    <Icon name="Minus" size={14} color={colors.brand} />
                  </TouchableOpacity>
                  <Text style={styles.timeVal}>{depHours}h</Text>
                  <TouchableOpacity
                    disabled={depHours >= 16}
                    onPress={() => adjustHours(1)}
                    style={[styles.stepBtnDark, depHours >= 16 && { opacity: 0.4 }]}
                  >
                    <Icon name="Plus" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.timeStepperBox}>
                <Text style={styles.timeUnit}>Minutes (±5)</Text>
                <View style={styles.timeStepper}>
                  <TouchableOpacity
                    disabled={offsetMinutes <= MIN_DEPARTURE_MINUTES}
                    onPress={() => adjustMins(-5)}
                    style={[
                      styles.stepBtnLight,
                      offsetMinutes <= MIN_DEPARTURE_MINUTES && { opacity: 0.4 },
                    ]}
                  >
                    <Icon name="Minus" size={14} color={colors.brand} />
                  </TouchableOpacity>
                  <Text style={styles.timeVal}>{String(depMins).padStart(2, '0')}m</Text>
                  <TouchableOpacity
                    disabled={offsetMinutes >= MAX_DEPARTURE_MINUTES}
                    onPress={() => adjustMins(5)}
                    style={[
                      styles.stepBtnDark,
                      offsetMinutes >= MAX_DEPARTURE_MINUTES && { opacity: 0.4 },
                    ]}
                  >
                    <Icon name="Plus" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Card>

          <View style={styles.seatCard}>
            <View>
              <Text style={styles.seatLabel}>Seats to offer</Text>
              {isBikeSelected ? (
                <Text style={styles.label}>Bikes can take 1 passenger max</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Array.from({ length: Math.min(maxSeats, 6) }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setSeats(n)}
                  style={[styles.seatPill, seats === n && styles.seatPillActive]}
                >
                  <Text style={[styles.seatNum, seats === n && { color: colors.white }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Field
            label="Fare per seat (PKR)"
            icon="Banknote"
            value={fareText}
            onChangeText={(v) => setFareText(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="150"
            helper={
              estimate
                ? `Suggested ${formatPkr(estimate.fare_per_passenger)} (${estimate.distance_km.toFixed(1)} km · ~${Math.round(estimate.duration_min)} min)`
                : 'Leave empty for automatic split-fuel calculation'
            }
          />

          <Field
            label="Ride notes (optional)"
            icon="FileText"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g., AC on, pickup near main road"
          />
        </View>
      </Screen>

      <Footer>
        <Button loading={loading} disabled={!selectedVehicleId} onPress={handlePublish}>
          Publish Ride
        </Button>
        <Text style={styles.footerHint}>Riders matching your route get notified</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  label: { fontSize: 12, fontWeight: '600', color: colors.ink3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locVal: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.line },
  seatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  seatLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  seatPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatPillActive: { backgroundColor: colors.brand },
  seatNum: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
  timeGrid: { flexDirection: 'row', gap: 10 },
  timeStepperBox: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  timeUnit: { fontSize: 11, fontWeight: '600', color: colors.ink3 },
  timeStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtnLight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeVal: { fontSize: 15, fontWeight: '700', color: colors.ink, minWidth: 34, textAlign: 'center' },
  warnText: { fontSize: 13, color: colors.ink2 },
  footerHint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
