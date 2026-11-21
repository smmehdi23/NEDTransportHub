import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  getApiError,
  historyApi,
  safetyApi,
  type HistoryItem,
  type ReportRead,
} from '../../api';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorBanner,
  Footer,
  Screen,
  TopBar,
} from '../../components/ui';
import { colors, radii } from '../../theme';
import { formatDateShort } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportIssue'>;

const CATEGORIES = ['Unsafe driving', 'Late or no-show', 'Rude behaviour', 'Payment issue'];

export function ReportIssueScreen({ navigation, route }: Props) {
  const initialRideId = route.params?.rideId;
  const reportedUserId = route.params?.reportedUserId;

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [details, setDetails] = useState('');
  const [rides, setRides] = useState<HistoryItem[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<number | null>(initialRideId ?? null);
  const [myReports, setMyReports] = useState<ReportRead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      historyApi.getMyHistory({ limit: 15 }).catch(() => []),
      safetyApi.getMyReports().catch(() => []),
    ]).then(([hist, reps]) => {
      setRides(hist);
      setMyReports(reps);
      if (!selectedRideId && hist[0]) {
        setSelectedRideId(hist[0].ride_id);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!selectedRideId) {
      setError('Select a ride associated with this issue.');
      return;
    }
    const fullDesc = `[${category}] ${details.trim()}`;
    if (fullDesc.length < 10) {
      setError('Please provide at least a short description of what happened.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await safetyApi.createReport({
        ride_id: selectedRideId,
        reported_user_id: reportedUserId ?? undefined,
        description: fullDesc,
      });
      Alert.alert(
        'Report Submitted',
        'NED Transport Admin has been notified and will review within 24 hours.',
      );
      navigation.goBack();
    } catch (err) {
      setError(getApiError(err, 'Could not submit report.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Report an issue" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.title}>What went wrong?</Text>
          <Text style={styles.sub}>
            Reports go confidentially to the NED transport admin team, not the driver.
          </Text>

          <ErrorBanner message={error} />

          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.catBtn, active && styles.catActive]}
                >
                  <Text style={[styles.catText, active && { color: colors.brand }]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {rides.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Select Ride</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {rides.slice(0, 6).map((h) => (
                  <Chip
                    key={`${h.role}-${h.ride_id}-${h.booking_id ?? 0}`}
                    active={selectedRideId === h.ride_id}
                    onPress={() => setSelectedRideId(h.ride_id)}
                  >
                    #{h.ride_id} · {formatDateShort(h.departure_time)}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Tell us more (at least 10 characters)"
            placeholderTextColor={colors.ink3}
            multiline
            style={styles.textArea}
          />

          {myReports.length > 0 ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={styles.label}>Your Previous Reports</Text>
              {myReports.map((rep) => (
                <Card key={rep.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.repTitle}>Report #{rep.id} · Ride #{rep.ride_id}</Text>
                    <Badge tone={rep.status === 'resolved' ? 'success' : 'warning'}>
                      {rep.status.replace('_', ' ')}
                    </Badge>
                  </View>
                  <Text style={styles.sub} numberOfLines={2}>
                    {rep.description}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      </Screen>

      <Footer>
        <Button loading={submitting} onPress={handleSubmit}>
          Submit Report
        </Button>
        <Text style={styles.hint}>We reply within 24 hours</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.ink2 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    width: '48%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 13,
  },
  catActive: { borderColor: colors.brand, backgroundColor: colors.brandSubtle },
  catText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  textArea: {
    height: 110,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.ink,
  },
  repTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  hint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
