import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Footer, Icon, Screen } from '../../components/ui';
import { colors } from '../../theme';
import { formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentFailed'>;

export function PaymentFailedScreen({ navigation, route }: Props) {
  const { bookingId, rideId, amount, method, reason, driverName } = route.params;
  const rows = [
    ['Amount', formatPkr(amount)],
    ['Method', method],
    ['Reason', reason ?? 'Payment could not be completed'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <View style={styles.content}>
          <View style={styles.circle}>
            <Icon name="X" size={38} color={colors.danger} />
          </View>
          <Text style={styles.title}>Payment Failed</Text>
          <Text style={styles.sub}>
            {method} could not complete the payment. You were not charged.
          </Text>

          <Card style={{ width: '100%', gap: 12 }}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={styles.label}>{k}</Text>
                <Text style={styles.val} numberOfLines={2}>
                  {v}
                </Text>
              </View>
            ))}
          </Card>

          <View style={{ width: '100%', gap: 8 }}>
            <Text style={styles.sectionTitle}>Try another way</Text>
            <Card
              onPress={() => navigation.replace('Payment', { bookingId, rideId, driverName })}
              style={styles.altRow}
            >
              <Icon name="Banknote" size={20} color={colors.brand} />
              <Text style={styles.altText}>Pay {driverName ?? 'driver'} in cash at drop-off</Text>
            </Card>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button onPress={() => navigation.replace('Payment', { bookingId, rideId, driverName })}>
          Retry Payment
        </Button>
        <Button
          variant="secondary"
          icon="Headset"
          onPress={() => navigation.navigate('ReportIssue', { rideId })}
        >
          Contact support
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 48, alignItems: 'center', gap: 16 },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13, color: colors.ink2 },
  val: { fontSize: 13, fontWeight: '700', color: colors.ink, flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  altRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  altText: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
