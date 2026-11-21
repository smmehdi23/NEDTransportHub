import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, paymentsApi, type PaymentRead } from '../../api';
import { Badge, Card, ErrorBanner, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentHistory'>;

export function PaymentHistoryScreen({ navigation }: Props) {
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [items, setItems] = useState<PaymentRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await paymentsApi.getHistory({ role });
      setItems(list);
    } catch (err) {
      setError(getApiError(err, 'Could not load payment history.'));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totalAmount = items
    .filter((p) => p.status === 'successful')
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <Screen>
      <TopBar title="Payment history" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <View style={styles.tabs}>
          {(['passenger', 'driver'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRole(r)}
              style={[styles.tabBtn, role === r && styles.tabActive]}
            >
              <Text style={[styles.tabText, role === r && { color: colors.white }]}>
                {r === 'passenger' ? 'Paid as Rider' : 'Received as Driver'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.banner}>
          <Text style={styles.bannerSub}>
            {role === 'passenger' ? 'Total paid' : 'Total fuel cost shared'}
          </Text>
          <Text style={styles.bannerVal}>{formatPkr(totalAmount)}</Text>
          <Text style={styles.bannerSub}>{items.length} transaction(s)</Text>
        </LinearGradient>

        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 28 }} />
        ) : items.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={styles.sub}>No transactions recorded yet.</Text>
          </Card>
        ) : (
          items.map((p) => {
            const isRefund = p.status === 'refunded' || p.refund_status !== 'none';
            return (
              <Card key={p.transaction_id} style={styles.row}>
                <View style={styles.iconBox}>
                  <Icon name={isRefund ? 'Undo2' : 'Car'} size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Booking #{p.booking_id}</Text>
                  <Text style={styles.sub}>
                    {p.method ?? 'unselected'} · {formatDateTime(p.created_at)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.amount, isRefund && { color: colors.success }]}>
                    {isRefund ? `+ ${formatPkr(p.amount)}` : formatPkr(p.amount)}
                  </Text>
                  <Badge
                    tone={
                      p.status === 'successful'
                        ? 'success'
                        : p.status === 'outstanding'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {p.status}
                  </Badge>
                </View>
              </Card>
            );
          })
        )}
      </View>
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
  banner: { borderRadius: radii.xl, padding: 20, gap: 4 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  bannerVal: { fontSize: 30, fontWeight: '700', color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
