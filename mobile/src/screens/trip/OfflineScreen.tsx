import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { offlineCache, type CachedBookingSnapshot } from '../../api';
import { Badge, Button, Card, Footer, Icon, Screen } from '../../components/ui';
import { colors } from '../../theme';
import { formatDateTime, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Offline'>;

export function OfflineScreen({ navigation }: Props) {
  const [cached, setCached] = useState<CachedBookingSnapshot | null>(null);

  useEffect(() => {
    offlineCache.getLastBooking().then(setCached).catch(() => null);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <View style={styles.content}>
          <View style={styles.circle}>
            <Icon name="WifiOff" size={34} color={colors.brand} />
          </View>
          <Text style={styles.title}>You are offline</Text>
          <Text style={styles.sub}>
            Check your mobile data or Wi-Fi. Your latest booking is saved locally and will sync
            automatically once you reconnect.
          </Text>

          {cached ? (
            <Card style={{ width: '100%', gap: 6 }}>
              <View style={styles.rowBetween}>
                <Badge tone="info">Saved offline</Badge>
                <Text style={styles.syncText}>Last synced {formatTime(cached.syncedAt)}</Text>
              </View>
              <Text style={styles.bold}>
                {cached.pickupName} → {cached.destinationName}
              </Text>
              <Text style={styles.subLeft}>
                Departure: {formatDateTime(cached.departureTime)}
              </Text>
            </Card>
          ) : null}

          <View style={styles.smsRow}>
            <Icon name="Siren" size={16} color={colors.danger} />
            <Text style={styles.smsText}>SOS still works by SMS when you are offline.</Text>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button
          icon="RefreshCw"
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          Try again
        </Button>
        <Button
          variant="danger"
          icon="MessageSquare"
          onPress={() =>
            Linking.openURL('sms:15?body=SOS%20Emergency%20on%20NED%20Transport%20Hub%20ride')
          }
        >
          Send Offline Emergency SMS
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 56, alignItems: 'center', gap: 16 },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, textAlign: 'center', lineHeight: 20 },
  subLeft: { fontSize: 13, color: colors.ink2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncText: { fontSize: 11, color: colors.ink3 },
  bold: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 4 },
  smsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smsText: { fontSize: 13, color: colors.ink2 },
});
