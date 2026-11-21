import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi, getApiError, type BookingRead } from '../../api';
import { Avatar, Badge, Card, ErrorBanner, Icon, Screen, TopBar } from '../../components/ui';
import { colors } from '../../theme';
import { formatDateShort, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

export function ChatListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [bookings, setBookings] = useState<BookingRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [asRider, asDriver] = await Promise.all([
        bookingsApi.listBookings({ as_driver: false }).catch(() => []),
        bookingsApi.listBookings({ as_driver: true }).catch(() => []),
      ]);
      const combined = [...asRider, ...asDriver].filter(
        (b) => b.status === 'confirmed' || b.status === 'completed',
      );
      const unique = Array.from(new Map(combined.map((b) => [b.id, b])).values());
      setBookings(unique);
    } catch (err) {
      setError(getApiError(err, 'Could not load chats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <TopBar title="Chats" />
      <View style={styles.content}>
        <ErrorBanner message={error} />
        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
        ) : bookings.length === 0 ? (
          <Card style={styles.empty}>
            <Icon name="MessageCircle" size={34} color={colors.brand} />
            <Text style={styles.emptyTitle}>No active ride chats</Text>
            <Text style={styles.emptySub}>
              Chat opens automatically once a booking is confirmed with a driver or rider.
            </Text>
          </Card>
        ) : (
          bookings.map((b) => (
            <Card
              key={b.id}
              onPress={() =>
                navigation.navigate('Chat', {
                  bookingId: b.id,
                  peerName: b.passenger.name,
                  subtitle: `${b.origin_name} → ${b.destination_name}`,
                })
              }
              style={styles.row}
            >
              <Avatar name={b.passenger.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {b.origin_name} → {b.destination_name}
                </Text>
                <Text style={styles.sub}>
                  Booking #{b.id} · {formatDateShort(b.departure_time)} {formatTime(b.departure_time)}
                </Text>
              </View>
              <Badge tone={b.status === 'confirmed' ? 'success' : 'neutral'}>{b.status}</Badge>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  emptySub: { fontSize: 13, color: colors.ink2, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
});
