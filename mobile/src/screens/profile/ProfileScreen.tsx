import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { historyApi, ratingsApi, safetyApi } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { Avatar, Badge, Card, Icon, Screen, type IconName } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut, refreshUser } = useAuth();
  const { showConfirm } = useDialog();
  const [rideCount, setRideCount] = useState(0);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [contactCount, setContactCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      if (!user) return;
      Promise.all([
        historyApi.getMyHistory({ limit: 100 }).catch(() => []),
        ratingsApi.getUserSummary(user.id).catch(() => null),
        safetyApi.listContacts().catch(() => []),
      ]).then(([hist, rat, contacts]) => {
        setRideCount(hist.length);
        setRatingAvg(rat?.average ?? null);
        setContactCount(contacts.length);
      });
    }, [user?.id]),
  );

  const handleLogout = () => {
    showConfirm({
      title: 'Log out?',
      message: 'You will need to sign in again to book or offer rides.',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      },
    });
  };

  const rows: [string, IconName, () => void, string?][] = [
    ['Personal details', 'User', () => navigation.navigate('EditProfile')],
    [
      'Trusted contacts',
      'ShieldCheck',
      () => navigation.navigate('TrustedContacts'),
      `${contactCount} contact${contactCount === 1 ? '' : 's'}`,
    ],
    ['Payment history', 'CreditCard', () => navigation.navigate('PaymentHistory')],
    [
      'Driver account',
      'Car',
      () =>
        navigation.navigate(user?.is_driver_verified ? 'DriverHome' : 'DriverStatus'),
      user?.is_driver_verified ? 'Verified' : 'Status',
    ],
    ['Notifications', 'Bell', () => navigation.navigate('Notifications')],
    ['Help and safety', 'CircleHelp', () => navigation.navigate('ReportIssue')],
  ];

  const estSaved = rideCount * 180;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Avatar name={user?.name ?? 'NED User'} size={84} />
        <Text style={styles.name}>{user?.name ?? 'NED Student'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Badge tone="success">NED verified</Badge>
          {user?.is_driver_verified ? <Badge tone="info">Verified Driver</Badge> : null}
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>{rideCount}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>{ratingAvg ? ratingAvg.toFixed(1) : 'New'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNum}>
              {estSaved >= 1000 ? `${(estSaved / 1000).toFixed(1)}k` : `${estSaved}`}
            </Text>
            <Text style={styles.statLabel}>PKR Saved</Text>
          </Card>
        </View>
      </View>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map(([label, icon, onPress, badge], idx) => (
          <TouchableOpacity
            key={label}
            activeOpacity={0.75}
            onPress={onPress}
            style={[styles.menuRow, idx > 0 && styles.menuBorder]}
          >
            <Icon name={icon} size={20} color={colors.brand} />
            <Text style={styles.menuLabel}>{label}</Text>
            {badge ? <Badge tone="info">{badge}</Badge> : null}
            <Icon name="ChevronRight" size={18} color={colors.ink3} />
          </TouchableOpacity>
        ))}
      </Card>

      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
        <Icon name="LogOut" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 8 },
  name: { fontSize: 20, fontWeight: '700', color: colors.ink, marginTop: 4 },
  email: { fontSize: 13, color: colors.ink2 },
  statsGrid: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 10 },
  statCard: { flex: 1, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.ink2, marginTop: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
});
