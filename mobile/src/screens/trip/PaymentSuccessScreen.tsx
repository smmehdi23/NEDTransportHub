import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Footer, Icon, Screen } from '../../components/ui';
import { colors } from '../../theme';
import { formatDateTime, formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentSuccess'>;

export function PaymentSuccessScreen({ navigation, route }: Props) {
  const { amount, method, transactionId, driverName, rideId, statusLabel } = route.params;
  const rows = [
    ['Amount', formatPkr(amount)],
    ['Method', method],
    ['Transaction ID', transactionId],
    ['Date', formatDateTime(new Date().toISOString())],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <View style={styles.content}>
          <View style={styles.circle}>
            <Icon name="Check" size={38} color={colors.success} />
          </View>
          <Text style={styles.title}>Payment Submitted</Text>
          <Text style={styles.sub}>
            {statusLabel ?? `${formatPkr(amount)} paid to ${driverName ?? 'driver'} via ${method}.`}
          </Text>

          <Card style={{ width: '100%', gap: 12 }}>
            {rows.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={styles.label}>{k}</Text>
                <Text style={styles.val}>{v}</Text>
              </View>
            ))}
          </Card>
        </View>
      </Screen>

      <Footer>
        <Button onPress={() => navigation.replace('RateRide', { rideId, driverName })}>
          Rate Your Ride
        </Button>
        <Button
          variant="secondary"
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          Back to Home
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
    backgroundColor: colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13, color: colors.ink2 },
  val: { fontSize: 13, fontWeight: '700', color: colors.ink },
});
