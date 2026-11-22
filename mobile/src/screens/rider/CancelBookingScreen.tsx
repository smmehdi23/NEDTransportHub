import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bookingsApi, getApiError } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { Button, ErrorBanner, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CancelBooking'>;

const REASONS = [
  'My plans changed',
  'I found another ride',
  'Driver asked me to cancel',
  'Something else',
];

export function CancelBookingScreen({ navigation, route }: Props) {
  const { bookingId, driverName } = route.params;
  const { showToast } = useDialog();
  const [reason, setReason] = useState(REASONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setError(null);
    setLoading(true);
    try {
      await bookingsApi.cancelBooking(bookingId, reason);
      showToast({
        title: 'Booking cancelled',
        message: 'Your seat has been released and the driver notified.',
        tone: 'info',
      });
      navigation.navigate('MainTabs', { screen: 'HomeTab' });
    } catch (err) {
      setError(getApiError(err, 'Could not cancel booking.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Cancel booking" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.title}>Why are you cancelling?</Text>
          <Text style={styles.sub}>
            {driverName ?? 'The driver'} will be notified and your seat released.
          </Text>

          <ErrorBanner message={error} />

          {REASONS.map((item) => {
            const active = reason === item;
            return (
              <TouchableOpacity
                key={item}
                activeOpacity={0.85}
                onPress={() => setReason(item)}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={styles.optionText}>{item}</Text>
                {active ? <Icon name="Check" size={18} color={colors.brand} /> : null}
              </TouchableOpacity>
            );
          })}

          <View style={styles.warnBox}>
            <Icon name="TriangleAlert" size={18} color={colors.warning} />
            <Text style={styles.warnText}>
              Cancelling within 30 minutes of departure lowers your reliability rating.
            </Text>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button variant="danger" loading={loading} onPress={handleCancel}>
          Cancel booking
        </Button>
        <Button variant="secondary" onPress={() => navigation.goBack()}>
          Keep my seat
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 14,
    color: colors.ink2,
    marginBottom: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 16,
  },
  optionActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.warningSubtle,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 6,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
  },
});
