import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ridesApi, type RideRead } from '../../api';
import { Button, Card, Icon, Screen, TopBar } from '../../components/ui';
import { KARACHI_PRESETS, NED_UNIVERSITY_COORDS } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import { formatDateShort, formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FindRide'>;

export function FindRideScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { pickup, dropoff, setPickup } = useRideFlow();
  const [query, setQuery] = useState('');
  const [openRides, setOpenRides] = useState<RideRead[]>([]);

  useEffect(() => {
    ridesApi
      .browseRides({ page_size: 10 })
      .then((res) => setOpenRides(res.items))
      .catch(() => setOpenRides([]));
  }, []);

  const filteredPresets = KARACHI_PRESETS.filter(
    (p) =>
      p.name !== NED_UNIVERSITY_COORDS.name &&
      p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const searchWithCurrent = () => {
    navigation.navigate('SearchResults', {
      query: query.trim() || undefined,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
      pickupName: pickup.name,
      dropoffName: dropoff.name,
    });
  };

  return (
    <Screen>
      <TopBar title="Find a ride" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.heading}>Find The Right{'\n'}Ride To Campus</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Icon name="Search" size={18} color={colors.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search area or landmark"
              placeholderTextColor={colors.ink3}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={searchWithCurrent}
            />
          </View>
          <TouchableOpacity onPress={searchWithCurrent} style={styles.filterBtn}>
            <Icon name="SlidersHorizontal" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>

        <Card style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('PickLocation', { target: 'pickup', returnTo: 'FindRide' })
            }
            style={styles.locRow}
          >
            <Icon name="MapPin" size={18} color={colors.accentBright} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locLabel}>Pickup</Text>
              <Text style={styles.locValue} numberOfLines={1}>
                {pickup.name}
              </Text>
            </View>
            <Icon name="ChevronRight" size={18} color={colors.ink3} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('PickLocation', { target: 'dropoff', returnTo: 'FindRide' })
            }
            style={styles.locRow}
          >
            <Icon name="GraduationCap" size={18} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locLabel}>Drop-off</Text>
              <Text style={styles.locValue} numberOfLines={1}>
                {dropoff.name}
              </Text>
            </View>
            <Icon name="ChevronRight" size={18} color={colors.ink3} />
          </TouchableOpacity>
          <Button icon="Search" onPress={searchWithCurrent}>
            Search Matching Rides
          </Button>
        </Card>

        {openRides.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Upcoming Campus Rides</Text>
            {openRides.slice(0, 4).map((ride) => (
              <Card
                key={ride.id}
                onPress={() => navigation.navigate('RideDetails', { rideId: ride.id, ride })}
                style={styles.routeCard}
              >
                <View style={styles.pinIcon}>
                  <Icon name="Car" size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeTitle} numberOfLines={1}>
                    {ride.origin_name} → {ride.destination_name}
                  </Text>
                  <Text style={styles.routeSub}>
                    {formatDateShort(ride.departure_time)} · {formatTime(ride.departure_time)} ·{' '}
                    {formatPkr(ride.estimated_fare)}
                  </Text>
                </View>
                <Icon name="ChevronRight" size={18} color={colors.ink3} />
              </Card>
            ))}
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Popular Campus Corridors</Text>
          {filteredPresets.map((preset) => (
            <Card
              key={preset.name}
              onPress={() => {
                setPickup({
                  name: preset.name,
                  subtitle: preset.area,
                  lat: preset.lat,
                  lng: preset.lng,
                });
                navigation.navigate('SearchResults', {
                  pickupLat: preset.lat,
                  pickupLng: preset.lng,
                  dropoffLat: dropoff.lat,
                  dropoffLng: dropoff.lng,
                  pickupName: preset.name,
                  dropoffName: dropoff.name,
                });
              }}
              style={styles.routeCard}
            >
              <View style={styles.pinIcon}>
                <Icon name="MapPin" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeTitle}>{preset.name}</Text>
                <Text style={styles.routeSub}>{preset.area} → NED University</Text>
              </View>
              <Icon name="ChevronRight" size={18} color={colors.ink3} />
            </Card>
          ))}
        </View>

        <View style={styles.offerBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.offerTitle}>Driving to campus?</Text>
            <Text style={styles.offerSub}>Offer empty seats and share fuel costs</Text>
          </View>
          <Button
            small
            onPress={() =>
              navigation.navigate(user?.is_driver_verified ? 'OfferRide' : 'BecomeDriver')
            }
          >
            Offer
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    color: colors.ink,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locLabel: {
    fontSize: 11,
    color: colors.ink3,
    fontWeight: '600',
  },
  locValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  routeSub: {
    fontSize: 12,
    color: colors.ink2,
    marginTop: 2,
  },
  offerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.xl,
    padding: 16,
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  offerSub: {
    fontSize: 13,
    color: colors.ink2,
    marginTop: 2,
  },
});
