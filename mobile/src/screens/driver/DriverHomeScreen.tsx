import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  bookingsApi,
  driversApi,
  paymentsApi,
  pollsApi,
  ratingsApi,
  ridesApi,
  type BookingRead,
  type DriverVerificationStatus,
  type PollRead,
  type RideRead,
} from '../../api';
import { Avatar, Badge, Button, Card, Icon } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, shadows } from '../../theme';
import { formatDateShort, formatPkr, formatTime, getGreeting } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverHome'>;

export function DriverHomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [verification, setVerification] = useState<DriverVerificationStatus | null>(null);
  const [myRides, setMyRides] = useState<RideRead[]>([]);
  const [pendingReqs, setPendingReqs] = useState<BookingRead[]>([]);
  const [polls, setPolls] = useState<PollRead[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [ver, ridesPage, bookings, payments, pollPage, rating] = await Promise.all([
        driversApi.getVerificationStatus().catch(() => null),
        ridesApi.browseRides({ mine: true, page_size: 20 }).catch(() => null),
        bookingsApi.listBookings({ as_driver: true, status: 'pending' }).catch(() => []),
        paymentsApi.getHistory({ role: 'driver', status: 'successful' }).catch(() => []),
        pollsApi.listPolls({ page_size: 5 }).catch(() => null),
        user ? ratingsApi.getUserSummary(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      if (ver) setVerification(ver);
      if (ridesPage) setMyRides(ridesPage.items);
      setPendingReqs(bookings);
      setTotalEarned(payments.reduce((acc, p) => acc + p.amount, 0));
      if (pollPage) setPolls(pollPage.items);
      if (rating) setAvgRating(rating.average);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const nextRide = myRides.find(
    (r) => r.status === 'in_progress' || r.status === 'open' || r.status === 'full',
  );
  const isVerified = verification?.is_driver_verified ?? user?.is_driver_verified ?? false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })} style={styles.circleBtn}>
            <Icon name="ChevronLeft" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{user?.name ?? 'Driver'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.circleBtn}
          >
            <Icon name="Bell" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeSwitch}>
          <TouchableOpacity
            onPress={() => navigation.navigate('FindRide')}
            style={styles.modeBtn}
          >
            <Text style={styles.modeBtnText}>Find a ride</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate(isVerified ? 'OfferRide' : 'BecomeDriver')}
            style={[styles.modeBtn, styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, { color: colors.white }]}>Offer a ride</Text>
          </TouchableOpacity>
        </View>

        {!isVerified ? (
          <Card style={{ backgroundColor: colors.warningSubtle, gap: 10 }}>
            <Badge tone="warning">Verification required</Badge>
            <Text style={styles.cardTitle}>Complete driver verification</Text>
            <Text style={styles.cardSub}>
              Submit your licence, vehicle registration, and NED ID to start offering rides.
            </Text>
            <Button
              small
              onPress={() =>
                navigation.navigate(
                  verification?.vehicles?.length ? 'DriverStatus' : 'BecomeDriver',
                )
              }
            >
              {verification?.vehicles?.length ? 'Check Verification Status' : 'Become a Driver'}
            </Button>
          </Card>
        ) : null}

        <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.heroCard}>
          {nextRide ? (
            <>
              <Text style={styles.heroLabel}>Your Next Ride</Text>
              <Text style={styles.heroTime}>{formatTime(nextRide.departure_time)}</Text>
              <Text style={styles.heroSub}>
                {formatDateShort(nextRide.departure_time)} ·{' '}
                {nextRide.total_seats - nextRide.available_seats} of {nextRide.total_seats} seats
                booked
              </Text>
              <Text style={styles.heroRoute} numberOfLines={1}>
                {nextRide.origin_name} → {nextRide.destination_name}
              </Text>
              <View style={styles.heroBtns}>
                <Button
                  small
                  variant="light"
                  onPress={() =>
                    nextRide.status === 'in_progress'
                      ? navigation.navigate('DriverActive', { rideId: nextRide.id })
                      : navigation.navigate('DriverRequests', { rideId: nextRide.id })
                  }
                >
                  {nextRide.status === 'in_progress' ? 'Open Live Ride' : 'Manage Ride'}
                </Button>
                <Button
                  small
                  variant="secondary"
                  onPress={() => navigation.navigate('DriverRides')}
                >
                  All Rides
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heroLabel}>Driver Mode</Text>
              <Text style={[styles.heroTime, { fontSize: 22, marginTop: 6 }]}>
                No upcoming rides scheduled
              </Text>
              <Text style={styles.heroSub}>
                Publish your daily campus commute and split fuel costs with verified NED riders.
              </Text>
              <View style={{ marginTop: 14 }}>
                <Button
                  small
                  variant="light"
                  icon="Plus"
                  onPress={() => navigation.navigate(isVerified ? 'OfferRide' : 'BecomeDriver')}
                >
                  Offer a Ride
                </Button>
              </View>
            </>
          )}
        </LinearGradient>

        <Card style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.cardTitle}>Driver Overview</Text>
            <Badge tone="info">{myRides.length} rides</Badge>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Fuel shared</Text>
              <Text style={styles.statVal}>{formatPkr(totalEarned)}</Text>
            </View>
            <View style={[styles.statCol, styles.statBorder]}>
              <Text style={styles.statLabel}>Requests</Text>
              <Text style={styles.statVal}>{pendingReqs.length}</Text>
            </View>
            <View style={[styles.statCol, styles.statBorder]}>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={styles.statVal}>{avgRating ? avgRating.toFixed(1) : 'New'}</Text>
            </View>
          </View>
        </Card>

        {pendingReqs.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Pending Seat Requests</Text>
            {pendingReqs.slice(0, 3).map((req) => (
              <Card key={req.id} style={styles.reqRow}>
                <Avatar name={req.passenger.name} size={42} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.reqName}>{req.passenger.name}</Text>
                    <Badge tone="info">New</Badge>
                  </View>
                  <Text style={styles.reqSub} numberOfLines={1}>
                    {req.origin_name} → {req.destination_name}
                  </Text>
                </View>
                <Button
                  small
                  onPress={() => navigation.navigate('DriverRequests', { rideId: req.ride_id })}
                >
                  Propose
                </Button>
              </Card>
            ))}
          </View>
        ) : null}

        {polls.length > 0 && isVerified ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Open Rider Polls</Text>
            {polls.map((poll) => (
              <Card key={poll.id} style={styles.reqRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName} numberOfLines={1}>
                    {poll.origin_name} → {poll.destination_name}
                  </Text>
                  <Text style={styles.reqSub}>
                    {formatDateShort(poll.departure_time)} {formatTime(poll.departure_time)} ·{' '}
                    {poll.vote_count} interested
                  </Text>
                </View>
                <Button
                  small
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('OfferRide', {
                      pollId: poll.id,
                      originName: poll.origin_name,
                      destName: poll.destination_name,
                      originLat: poll.origin_lat,
                      originLng: poll.origin_lng,
                      destLat: poll.dest_lat,
                      destLng: poll.dest_lng,
                    })
                  }
                >
                  Offer
                </Button>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: 20, gap: 16, paddingBottom: 32 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  greeting: { fontSize: 12, color: colors.ink2 },
  name: { fontSize: 20, fontWeight: '700', color: colors.ink },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    padding: 4,
    ...shadows.card,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.brand },
  modeBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
  heroCard: { borderRadius: radii.xxl, padding: 20, ...shadows.button },
  heroLabel: { fontSize: 13, color: colors.accent },
  heroTime: { fontSize: 34, fontWeight: '700', color: colors.white, marginTop: 2 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroRoute: { fontSize: 14, fontWeight: '600', color: colors.white, marginTop: 8 },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statsCard: { backgroundColor: '#e2eaf8', borderColor: '#c9d8f3', gap: 14 },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
  statCol: { flex: 1 },
  statBorder: { borderLeftWidth: 1, borderLeftColor: '#a9c3ee', paddingLeft: 12 },
  statLabel: { fontSize: 12, color: colors.ink2 },
  statVal: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cardSub: { fontSize: 13, color: colors.ink2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reqName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  reqSub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
});
