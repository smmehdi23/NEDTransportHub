import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { driversApi, getApiError, type DriverVerificationStatus } from '../../api';
import { Badge, Button, Card, ErrorBanner, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radii } from '../../theme';
import { formatDateTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverStatus'>;

export function DriverStatusScreen({ navigation }: Props) {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<DriverVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await driversApi.getVerificationStatus();
      setStatus(data);
      if (data.is_driver_verified) {
        await refreshUser();
      }
    } catch (err) {
      setError(getApiError(err, 'Could not load verification status.'));
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const latestVehicle = status?.vehicles?.[status.vehicles.length - 1];
  const vStatus = latestVehicle?.verification_status;

  const badgeTone =
    vStatus === 'verified' ? 'success' : vStatus === 'rejected' ? 'danger' : 'warning';
  const bannerBg =
    vStatus === 'verified'
      ? colors.successSubtle
      : vStatus === 'rejected'
      ? colors.dangerSubtle
      : colors.warningSubtle;

  const steps: [string, string, boolean][] = [
    ['Documents submitted', latestVehicle ? formatDateTime(latestVehicle.created_at) : 'Pending', Boolean(latestVehicle)],
    ['Vehicle registered', latestVehicle ? `${latestVehicle.model} (${latestVehicle.plate_number})` : 'Not added', Boolean(latestVehicle)],
    [
      'Admin review',
      vStatus === 'verified' ? 'Approved' : vStatus === 'rejected' ? 'Action needed' : 'In progress',
      vStatus === 'verified',
    ],
    ['Start offering rides', vStatus === 'verified' ? 'Active' : 'After approval', Boolean(status?.is_driver_verified)],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Verification" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <ErrorBanner message={error} />
          {loading ? (
            <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 32 }} />
          ) : !latestVehicle ? (
            <Card style={{ gap: 12 }}>
              <Badge tone="info">Not applied yet</Badge>
              <Text style={styles.title}>Become a verified NED driver</Text>
              <Text style={styles.sub}>
                Submit your driving licence, vehicle registration, and NED ID to start sharing rides.
              </Text>
              <Button onPress={() => navigation.navigate('BecomeDriver')}>
                Start Application
              </Button>
            </Card>
          ) : (
            <>
              <View style={[styles.banner, { backgroundColor: bannerBg }]}>
                <Badge tone={badgeTone}>
                  {vStatus === 'verified'
                    ? 'Verified Driver'
                    : vStatus === 'rejected'
                    ? 'Rejected'
                    : 'Under Review'}
                </Badge>
                <Text style={styles.title}>Driver account</Text>
                <Text style={styles.sub}>
                  {vStatus === 'verified'
                    ? 'Your vehicle is verified! You can now offer rides to campus.'
                    : vStatus === 'rejected'
                    ? latestVehicle.rejection_reason ?? 'Please update your documents and resubmit.'
                    : 'The NED admin team is reviewing your documents. This usually takes less than 24 hours.'}
                </Text>
              </View>

              <Card style={{ gap: 0 }}>
                {steps.map(([label, desc, done], idx) => (
                  <View key={label} style={styles.stepRow}>
                    <View style={styles.stepLineCol}>
                      <View style={[styles.stepDot, done && styles.stepDotDone]}>
                        {done ? <Icon name="Check" size={14} color={colors.white} /> : null}
                      </View>
                      {idx < steps.length - 1 ? <View style={styles.stepLine} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: idx < steps.length - 1 ? 18 : 0 }}>
                      <Text style={styles.stepTitle}>{label}</Text>
                      <Text style={styles.stepSub}>{desc}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}
        </View>
      </Screen>

      <Footer>
        {status?.is_driver_verified ? (
          <Button icon="Car" onPress={() => navigation.navigate('OfferRide')}>
            Offer a Ride
          </Button>
        ) : vStatus === 'rejected' && latestVehicle ? (
          <Button
            icon="RefreshCw"
            onPress={() =>
              navigation.navigate('DriverDocs', { resubmitVehicleId: latestVehicle.id })
            }
          >
            Fix & Resubmit Documents
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          Back to home
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  banner: { borderRadius: radii.xl, padding: 20, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2, lineHeight: 19 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepLineCol: { alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepLine: { width: 1.5, flex: 1, backgroundColor: colors.line, marginVertical: 2 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  stepSub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
});
