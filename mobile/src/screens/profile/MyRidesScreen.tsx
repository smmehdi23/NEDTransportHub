import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  bookingsApi,
  getApiError,
  historyApi,
  pollsApi,
  type BookingRead,
  type HistoryItem,
  type PollRead,
} from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { RoutePointPickerModal } from '../../components/RoutePointPickerModal';
import { Badge, Button, Card, ErrorBanner, Screen, TopBar } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

export function MyRidesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, refreshUser } = useAuth();
  const { setPickup, setDropoff } = useRideFlow();
  const { showConfirm, showToast } = useDialog();

  const [tab, setTab] = useState<'Active' | 'Polls' | 'Past'>('Active');
  const [pollScope, setPollScope] = useState<'live' | 'mine'>('live');
  const [bookings, setBookings] = useState<BookingRead[]>([]);
  const [livePolls, setLivePolls] = useState<PollRead[]>([]);
  const [myPolls, setMyPolls] = useState<PollRead[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [votingId, setVotingId] = useState<number | null>(null);
  const [pickerPoll, setPickerPoll] = useState<PollRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await refreshUser();
      const [bList, livePage, minePage, hList] = await Promise.all([
        bookingsApi.listBookings({ as_driver: false }).catch(() => []),
        pollsApi.listPolls({ mine: false, sort: 'votes', page_size: 40 }).catch(() => null),
        pollsApi.listPolls({ mine: true, page_size: 30 }).catch(() => null),
        historyApi.getMyHistory({ role: 'passenger', limit: 50 }).catch(() => []),
      ]);
      setBookings(bList);
      setLivePolls(livePage?.items ?? []);
      setMyPolls(minePage?.items ?? []);
      setHistory(hList);
    } catch (err) {
      setError(getApiError(err, 'Could not load rides.'));
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeBookings = bookings.filter(
    (b) =>
      (b.status === 'pending' || b.status === 'confirmed') &&
      b.ride_status !== 'completed' &&
      b.ride_status !== 'cancelled',
  );
  const pastHistory = history.filter((h) => h.bucket !== 'upcoming');

  const openBooking = (b: BookingRead) => {
    if (b.ride_status === 'in_progress') {
      navigation.navigate('ActiveRide', { rideId: b.ride_id, bookingId: b.id });
    } else if (b.status === 'pending' && b.fare_status === 'proposed') {
      navigation.navigate('FareReview', { bookingId: b.id, booking: b });
    } else if (b.status === 'confirmed') {
      navigation.navigate('BookingConfirmed', { bookingId: b.id, rideId: b.ride_id });
    } else {
      navigation.navigate('WaitingForSeats', { bookingId: b.id, rideId: b.ride_id });
    }
  };

  const handleToggleVote = async (poll: PollRead) => {
    setVotingId(poll.id);
    try {
      if (poll.has_voted) {
        await pollsApi.removeVote(poll.id);
        showToast({ title: 'Removed from poll', tone: 'info' });
      } else {
        await pollsApi.vote(poll.id);
        showToast({
          title: 'Joined ride poll!',
          message: 'You will be notified when a driver offers this route.',
          tone: 'success',
        });
      }
      await load();
    } catch (err) {
      setError(getApiError(err, 'Could not update poll vote.'));
    } finally {
      setVotingId(null);
    }
  };

  const handleClosePoll = (poll: PollRead) => {
    showConfirm({
      title: 'Close ride poll?',
      message: `Stop looking for rides from ${poll.origin_name} to ${poll.destination_name}?`,
      confirmLabel: 'Close Poll',
      destructive: true,
      onConfirm: async () => {
        try {
          await pollsApi.closePoll(poll.id);
          showToast({ title: 'Ride poll closed', tone: 'info' });
          load();
        } catch (err) {
          setError(getApiError(err, 'Could not close poll.'));
        }
      },
    });
  };

  const shownPolls = pollScope === 'live' ? livePolls : myPolls;

  return (
    <Screen>
      <TopBar title="My rides" />
      <View style={styles.content}>
        <View style={styles.tabs}>
          {(['Active', 'Polls', 'Past'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && { color: colors.white }]}>
                {t === 'Polls' && livePolls.length > 0 ? `Polls (${livePolls.length})` : t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
        ) : tab === 'Active' ? (
          activeBookings.length === 0 ? (
            <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
              <Text style={styles.sub}>No active bookings right now.</Text>
              <Button small icon="Search" onPress={() => navigation.navigate('FindRide')}>
                Find a Ride
              </Button>
            </Card>
          ) : (
            activeBookings.map((b) => (
              <Card key={b.id} onPress={() => openBooking(b)} style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title}>{formatDateTime(b.departure_time)}</Text>
                  <Badge
                    tone={
                      b.status === 'confirmed'
                        ? 'success'
                        : b.fare_status === 'proposed'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {b.status === 'pending' && b.fare_status === 'proposed'
                      ? 'Review Fare'
                      : b.status}
                  </Badge>
                </View>
                <Text style={styles.sub}>
                  {b.origin_name} → {b.destination_name}
                </Text>
                <Text style={styles.fare}>{formatPkr(b.proposed_fare)}</Text>
              </Card>
            ))
          )
        ) : tab === 'Polls' ? (
          <>
            <View style={styles.subTabs}>
              <TouchableOpacity
                onPress={() => setPollScope('live')}
                style={[styles.subTabBtn, pollScope === 'live' && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, pollScope === 'live' && { color: colors.brand }]}>
                  All Live Polls ({livePolls.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPollScope('mine')}
                style={[styles.subTabBtn, pollScope === 'mine' && styles.subTabActive]}
              >
                <Text style={[styles.subTabText, pollScope === 'mine' && { color: colors.brand }]}>
                  My Polls ({myPolls.length})
                </Text>
              </TouchableOpacity>
            </View>

            {shownPolls.length === 0 ? (
              <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
                <Text style={styles.sub}>
                  {pollScope === 'live'
                    ? 'No open ride polls right now.'
                    : 'You have not posted any ride request polls yet.'}
                </Text>
                <Button small icon="Search" onPress={() => navigation.navigate('FindRide')}>
                  Find or Request a Ride
                </Button>
              </Card>
            ) : (
              shownPolls.map((poll) => {
                const isMine = poll.creator_id === user?.id;
                return (
                  <Card key={poll.id} style={{ gap: 10 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.title}>{formatDateTime(poll.departure_time)}</Text>
                      <Badge
                        tone={
                          poll.status === 'open'
                            ? 'info'
                            : poll.status === 'converted'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {poll.status}
                      </Badge>
                    </View>
                    <Text style={styles.routeTitle}>
                      {poll.origin_name} → {poll.destination_name}
                    </Text>
                    <Text style={styles.pollMeta}>
                      Posted by {isMine ? 'You' : poll.creator_name} · {poll.seats_needed} seat
                      {poll.seats_needed === 1 ? '' : 's'} · {poll.vote_count} interested
                    </Text>

                    {poll.status === 'open' ? (
                      <View style={styles.pollActions}>
                        {!isMine ? (
                          <Button
                            small
                            variant={poll.has_voted ? 'secondary' : 'primary'}
                            loading={votingId === poll.id}
                            onPress={() => handleToggleVote(poll)}
                            style={{ flex: 1 }}
                          >
                            {poll.has_voted ? 'Joined ✓' : 'Join Poll'}
                          </Button>
                        ) : (
                          <Button
                            small
                            variant="secondary"
                            onPress={() => handleClosePoll(poll)}
                            style={{ flex: 1 }}
                          >
                            Close Poll
                          </Button>
                        )}
                        <Button
                          small
                          variant="secondary"
                          icon="MapPin"
                          onPress={() => setPickerPoll(poll)}
                          style={{ flex: 1 }}
                        >
                          Pickup (≤500m)
                        </Button>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </>
        ) : (
          <>
            {pastHistory.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={styles.sub}>No past rides yet.</Text>
              </Card>
            ) : (
              pastHistory.map((h) => (
                <Card
                  key={`${h.role}-${h.ride_id}-${h.booking_id ?? 0}`}
                  onPress={() => {
                    if (h.bucket === 'completed' && h.booking_id) {
                      navigation.navigate('Payment', {
                        bookingId: h.booking_id,
                        rideId: h.ride_id,
                      });
                    }
                  }}
                  style={{ gap: 6 }}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.title}>{formatDateTime(h.departure_time)}</Text>
                    <Badge tone={h.bucket === 'completed' ? 'success' : 'neutral'}>
                      {h.bucket}
                    </Badge>
                  </View>
                  <Text style={styles.sub}>
                    {h.origin_name} → {h.destination_name}
                  </Text>
                  <Text style={styles.fare}>{formatPkr(h.fare)}</Text>
                </Card>
              ))
            )}
            <Card onPress={() => navigation.navigate('PaymentHistory')}>
              <Text style={[styles.title, { color: colors.brand }]}>
                View full payment history →
              </Text>
            </Card>
          </>
        )}

        <Button
          variant="secondary"
          icon="Car"
          onPress={() =>
            navigation.navigate(user?.is_driver_verified ? 'DriverRides' : 'BecomeDriver')
          }
        >
          Switch to driver view
        </Button>
      </View>

      {pickerPoll ? (
        <RoutePointPickerModal
          visible={Boolean(pickerPoll)}
          title="Pick pickup along poll route (≤ 500m)"
          subtitle={`${pickerPoll.origin_name} → ${pickerPoll.destination_name}`}
          route={[
            [pickerPoll.origin_lat, pickerPoll.origin_lng],
            [pickerPoll.dest_lat, pickerPoll.dest_lng],
          ]}
          origin={{
            name: pickerPoll.origin_name,
            lat: pickerPoll.origin_lat,
            lng: pickerPoll.origin_lng,
          }}
          destination={{
            name: pickerPoll.destination_name,
            lat: pickerPoll.dest_lat,
            lng: pickerPoll.dest_lng,
          }}
          initialPoint={{
            name: pickerPoll.origin_name,
            lat: pickerPoll.origin_lat,
            lng: pickerPoll.origin_lng,
          }}
          onClose={() => setPickerPoll(null)}
          onConfirm={async (pt) => {
            const targetPoll = pickerPoll;
            setPickerPoll(null);
            if (!targetPoll.has_voted && targetPoll.creator_id !== user?.id) {
              await pollsApi.vote(targetPoll.id).catch(() => null);
            }
            setPickup({
              name: pt.name,
              subtitle: `${pt.distanceM}m from poll route`,
              lat: pt.lat,
              lng: pt.lng,
            });
            setDropoff({
              name: targetPoll.destination_name,
              lat: targetPoll.dest_lat,
              lng: targetPoll.dest_lng,
            });
            showToast({
              title: 'Pickup set along poll route!',
              message: `${pt.name} (${pt.distanceM}m from route). Searching matching rides...`,
              tone: 'success',
            });
            navigation.navigate('SearchResults', {
              pickupLat: pt.lat,
              pickupLng: pt.lng,
              dropoffLat: targetPoll.dest_lat,
              dropoffLng: targetPoll.dest_lng,
              pickupName: pt.name,
              dropoffName: targetPoll.destination_name,
            });
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: colors.brand },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
  subTabs: { flexDirection: 'row', gap: 8 },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  subTabActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
  },
  subTabText: { fontSize: 12, fontWeight: '700', color: colors.ink2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  routeTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  fare: { fontSize: 15, fontWeight: '700', color: colors.brand },
  pollMeta: { fontSize: 12, fontWeight: '600', color: colors.brand },
  pollActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
});
