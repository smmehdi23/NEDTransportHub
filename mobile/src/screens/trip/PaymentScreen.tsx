import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, paymentsApi, type PaymentMethod, type PaymentRead } from '../../api';
import {
  Button,
  ErrorBanner,
  Footer,
  Icon,
  Screen,
  TopBar,
  type IconName,
} from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatPkr } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

const METHODS: {
  label: string;
  desc: string;
  icon: IconName;
  apiMethod: PaymentMethod;
}[] = [
  { label: 'JazzCash', desc: 'Online mobile wallet', icon: 'Smartphone', apiMethod: 'online' },
  { label: 'Easypaisa', desc: 'Online mobile wallet', icon: 'Wallet', apiMethod: 'online' },
  { label: 'Card', desc: 'Visa, Mastercard', icon: 'CreditCard', apiMethod: 'online' },
  { label: 'Cash to driver', desc: 'Driver confirms receipt', icon: 'Banknote', apiMethod: 'cash' },
];

export function PaymentScreen({ navigation, route }: Props) {
  const { bookingId, rideId, driverName } = route.params;
  const [selected, setSelected] = useState(0);
  const [payment, setPayment] = useState<PaymentRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    paymentsApi
      .getBookingPayment(bookingId)
      .then(setPayment)
      .catch((err) =>
        setError(getApiError(err, 'Payment becomes available once the driver completes the ride.')),
      )
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handlePay = async () => {
    const choice = METHODS[selected];
    setError(null);
    setSubmitting(true);
    try {
      const res = await paymentsApi.payBooking(bookingId, choice.apiMethod);
      navigation.replace('PaymentSuccess', {
        amount: res.payment.amount,
        method: choice.label,
        transactionId: res.payment.transaction_id,
        driverName,
        rideId,
        statusLabel:
          choice.apiMethod === 'cash'
            ? 'Cash declared — awaiting driver confirmation'
            : 'Checkout created — processing payment',
      });
    } catch (err) {
      const reason = getApiError(err, 'Payment could not be initiated.');
      if (payment) {
        navigation.navigate('PaymentFailed', {
          bookingId,
          rideId,
          amount: payment.amount,
          method: choice.label,
          reason,
          driverName,
        });
      } else {
        setError(reason);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Payment" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <ErrorBanner message={error} />
          {loading ? (
            <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
          ) : (
            <>
              <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.banner}>
                <Text style={styles.bannerSub}>Ride Completed · NED Transport Hub</Text>
                <Text style={styles.bannerAmount}>{formatPkr(payment?.amount)}</Text>
                <Text style={styles.bannerSub}>Driver: {driverName ?? 'NED Driver'}</Text>
              </LinearGradient>

              <Text style={styles.sectionTitle}>Pay With</Text>
              {METHODS.map((m, idx) => {
                const active = selected === idx;
                return (
                  <TouchableOpacity
                    key={m.label}
                    activeOpacity={0.85}
                    onPress={() => setSelected(idx)}
                    style={[styles.methodCard, active && styles.methodActive]}
                  >
                    <View style={styles.methodIcon}>
                      <Icon name={m.icon} size={20} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodTitle}>{m.label}</Text>
                      <Text style={styles.methodDesc}>{m.desc}</Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      </Screen>

      <Footer>
        <Button
          disabled={!payment || payment.status === 'successful'}
          loading={submitting}
          onPress={handlePay}
        >
          {payment?.status === 'successful'
            ? 'Already Paid'
            : `Pay ${formatPkr(payment?.amount)}`}
        </Button>
        <Text style={styles.secureNote}>{METHODS[selected].label} · Secure checkout</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  banner: { borderRadius: radii.xl, padding: 24, alignItems: 'center', gap: 4 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  bannerAmount: { fontSize: 36, fontWeight: '700', color: colors.white, marginVertical: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  methodActive: { borderColor: colors.brand, backgroundColor: colors.brandSubtle },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  methodDesc: { fontSize: 12, color: colors.ink2, marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  secureNote: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
