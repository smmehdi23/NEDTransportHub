import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, notificationsApi, type NotificationRead } from '../../api';
import { Badge, Card, ErrorBanner, Icon, Screen, TopBar, type IconName } from '../../components/ui';
import { colors } from '../../theme';
import { formatDateTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

function iconForType(type: string): IconName {
  if (type.includes('sos')) return 'Siren';
  if (type.includes('payment') || type.includes('refund')) return 'Wallet';
  if (type.includes('rating')) return 'Star';
  if (type.includes('chat')) return 'MessageCircle';
  if (type.includes('booking') || type.includes('fare')) return 'Users';
  return 'Car';
}

export function NotificationsScreen({ navigation }: Props) {
  const [items, setItems] = useState<NotificationRead[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await notificationsApi.list({ page_size: 50 });
      setItems(page.items);
      setUnread(page.unread);
    } catch (err) {
      setError(getApiError(err, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (err) {
      setError(getApiError(err, 'Could not mark notifications read.'));
    }
  };

  const handleTap = async (item: NotificationRead) => {
    if (!item.is_read) {
      notificationsApi.markRead(item.id).catch(() => null);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
  };

  return (
    <Screen>
      <TopBar
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          unread > 0 ? (
            <TouchableOpacity onPress={handleMarkAll}>
              <Text style={styles.markAll}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <View style={styles.content}>
        <ErrorBanner message={error} />
        {unread > 0 ? <Badge tone="info">{unread} unread</Badge> : null}

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Icon name="Bell" size={32} color={colors.ink3} />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} onPress={() => handleTap(item)} style={styles.row}>
              <View style={styles.iconBox}>
                <Icon name={iconForType(item.type)} size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
              </View>
              {!item.is_read ? <View style={styles.dot} /> : null}
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  markAll: { fontSize: 13, fontWeight: '700', color: colors.brand },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  body: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  time: { fontSize: 11, color: colors.ink3, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
  emptyText: { fontSize: 14, color: colors.ink2 },
});
