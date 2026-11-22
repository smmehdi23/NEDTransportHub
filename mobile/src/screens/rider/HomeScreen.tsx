import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  bookingsApi,
  historyApi,
  notificationsApi,
  offlineCache,
  pollsApi,
  type BookingRead,
  type HistoryItem,
  type PollRead,
} from '../../api';
import { Avatar, Badge, Card, Icon, type IconName } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, shadows } from '../../theme';
import { formatDateShort, formatTime, getGreeting } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isOffline, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [nextBooking, setNextBooking] = useState<BookingRead | null>(null);
  const [myPolls, setMyPolls] = useState<PollRead[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const me = await refreshUser();
      if (!me) return;
      const [notifRes, bookingsRes, historyRes, pollPage] = await Promise.all([
        notificationsApi.list({ unread_only: true, page_size: 1 }).catch(() => null),
        bookingsApi.listBookings({ as_driver: false }).catch(() => [] as BookingRead[]),
        historyApi.getMyHistory({ limit: 50 }).catch(() => [] as HistoryItem[]),
        pollsApi.listPolls({ mine: true, page_size: 5 }).catch(() => null),
      ]);
      if (notifRes) setUnread(notifRes.unread);
      setHistory(historyRes);
      setMyPolls((pollPage?.items ?? []).filter((p) => p.status === 'open'));

      const upcoming = bookingsRes.find(
        (b) =>
          (b.status === 'confirmed' || b.status === 'pending') &&
          b.ride_status !== 'completed' &&
          b.ride_status !== 'cancelled',
      );
      setNextBooking(upcoming ?? null);
      if (upcoming) {
        await offlineCache.saveLastBooking({
          bookingId: upcoming.id,
          rideId: upcoming.ride_id,
          pickupName: upcoming.pickup_name ?? upcoming.origin_name,
          destinationName: upcoming.destination_name,
          departureTime: upcoming.departure_time,
          fare: upcoming.proposed_fare,
          syncedAt: new Date().toISOString(),
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const completedCount = history.filter((h) => h.bucket === 'completed').length;
  const estSavedPkr = completedCount * 180;

  const quickActions: [string, IconName, () => void][] = [
    ['Find Ride', 'Search', () => navigation.navigate('FindRide')],
    [
      'Offer Ride',
      'Car',
      () => navigation.navigate(user?.is_driver_verified ? 'DriverHome' : 'BecomeDriver'),
    ],
    ['Trusted Contacts', 'ShieldCheck', () => navigation.navigate('TrustedContacts')],
    ['Ride History', 'Clock', () => navigation.navigate('PaymentHistory')],
  ];

  const handleOpenNextBooking = () => {
    if (!nextBooking) {
      navigation.navigate('FindRide');
      return;
    }
    if (nextBooking.ride_status === 'in_progress') {
      navigation.navigate('ActiveRide', {
        rideId: nextBooking.ride_id,
        bookingId: nextBooking.id,
      });
    } else if (nextBooking.status === 'pending' && nextBooking.fare_status === 'proposed') {
      navigation.navigate('FareReview', { bookingId: nextBooking.id, booking: nextBooking });
    } else if (nextBooking.status === 'confirmed') {
      navigation.navigate('BookingConfirmed', {
        bookingId: nextBooking.id,
        rideId: nextBooking.ride_id,
      });
    } else {
      navigation.navigate('WaitingForSeats', {
        bookingId: nextBooking.id,
        rideId: nextBooking.ride_id,
      });
    }
  };

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
              loadData();
            }}
          />
        }
      >
        {isOffline ? (
          <TouchableOpacity
            style={styles.offlineBanner}
            onPress={() => navigation.navigate('Offline')}
          >
            <Icon name="WifiOff" size={16} color={colors.warning} />
            <Text style={styles.offlineText}>You are offline — tap to view saved booking</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.header}>
          <Avatar name={user?.name ?? 'NED Student'} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name ?? 'NED Student'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bellBtn}
          >
            <Icon name="Bell" size={20} color={colors.ink} />
            {unread > 0 ? <View style={styles.bellDot} /> : null}
          </TouchableOpacity>
        </View>

        <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.heroCard}>
          {nextBooking ? (
            <>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Your Next Ride</Text>
                <Text style={styles.heroLabel}>{formatDateShort(nextBooking.departure_time)}</Text>
              </View>
              <View style={styles.heroRouteRow}>
                <Text style={styles.heroRouteText} numberOfLines={1}>
                  {nextBooking.origin_name}
                </Text>
                <Icon name="ArrowRight" size={18} color={colors.white} />
                <Text style={styles.heroRouteText} numberOfLines={1}>
                  {nextBooking.destination_name}
                </Text>
              </View>
              <View style={styles.heroBottom}>
                <View style={styles.heroMeta}>
                  <Badge tone={nextBooking.status === 'confirmed' ? 'success' : 'warning'}>
                    {nextBooking.fare_status === 'proposed' && nextBooking.status === 'pending'
                      ? 'Review Fare'
                      : nextBooking.status}
                  </Badge>
                  <Text style={styles.heroTime}>{formatTime(nextBooking.departure_time)}</Text>
                </View>
                <TouchableOpacity onPress={handleOpenNextBooking} style={styles.detailsPill}>
                  <Text style={styles.detailsPillText}>Details</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>Heading to campus?</Text>
                <Text style={styles.heroLabel}>NED University</Text>
              </View>
              <Text style={styles.heroEmptyTitle}>Find a verified carpool ride today</Text>
              <View style={[styles.heroBottom, { marginTop: 14 }]}>
                <Text style={styles.heroTime}>Split fuel costs with classmates</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('FindRide')}
                  style={styles.detailsPill}
                >
                  <Text style={styles.detailsPillText}>Find Ride</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ride Overview</Text>
            <Badge tone="info">Your Activity</Badge>
          </View>
          <View style={styles.statsGrid}>
            <Card style={{ flex: 1 }}>
              <Text style={styles.statNum}>{history.length}</Text>
              <Text style={styles.statLabel}>Rides total</Text>
            </Card>
            <Card style={{ flex: 1 }}>
              <Text style={styles.statNum}>
                {estSavedPkr >= 1000
                  ? `${(estSavedPkr / 1000).toFixed(1)}k`
                  : String(estSavedPkr)}
              </Text>
              <Text style={styles.statLabel}>PKR est. saved</Text>
            </Card>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickGrid}>
            {quickActions.map(([label, iconName, onPress]) => (
              <TouchableOpacity
                key={label}
                activeOpacity={0.85}
                onPress={onPress}
                style={styles.quickItem}
              >
                <View style={styles.quickIcon}>
                  <Icon name={iconName} size={20} color={colors.brand} />
                </View>
                <Text style={styles.quickLabel} numberOfLines={2}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {myPolls.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Active Ride Polls</Text>
              <Badge tone="info">{myPolls.length} open</Badge>
            </View>
            {myPolls.slice(0, 2).map((poll) => (
              <Card
                key={poll.id}
                onPress={() => navigation.navigate('MainTabs', { screen: 'MyRidesTab' })}
                style={styles.driverSwitchCard}
              >
                <View style={styles.quickIcon}>
                  <Icon name="Megaphone" size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverCardTitle} numberOfLines={1}>
                    {poll.origin_name} → {poll.destination_name}
                  </Text>
                  <Text style={styles.driverCardSub}>
                    {poll.seats_needed} seat{poll.seats_needed === 1 ? '' : 's'} ·{' '}
                    {formatDateShort(poll.departure_time)} {formatTime(poll.departure_time)}
                  </Text>
                </View>
                <Icon name="ChevronRight" size={18} color={colors.ink3} />
              </Card>
            ))}
          </View>
        ) : null}

        {user?.is_driver_verified ? (
          <Card
            onPress={() => navigation.navigate('DriverHome')}
            style={styles.driverSwitchCard}
          >
            <View style={styles.quickIcon}>
              <Icon name="Car" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverCardTitle}>Driver Dashboard</Text>
              <Text style={styles.driverCardSub}>Offer rides & manage seat requests</Text>
            </View>
            <Icon name="ChevronRight" size={20} color={colors.ink3} />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    padding: 20,
    gap: 22,
    paddingBottom: 32,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningSubtle,
    padding: 12,
    borderRadius: radii.md,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: 13,
    color: colors.ink2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  heroCard: {
    borderRadius: radii.xl,
    padding: 20,
    ...shadows.button,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  heroRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  heroRouteText: {
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '700',
    color: colors.white,
  },
  heroEmptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginTop: 10,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  detailsPill: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  detailsPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statNum: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 13,
    color: colors.ink2,
    marginTop: 2,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickItem: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
    ...shadows.card,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  driverSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  driverCardSub: {
    fontSize: 12,
    color: colors.ink2,
    marginTop: 2,
  },
});
