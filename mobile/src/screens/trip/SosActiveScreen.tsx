import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, safetyApi, type ContactRead } from '../../api';
import { Button, Card, ErrorBanner, Footer, Icon, Screen } from '../../components/ui';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SosActive'>;

export function SosActiveScreen({ navigation, route }: Props) {
  const { rideId, autoTrigger = true } = route.params;
  const [seconds, setSeconds] = useState(0);
  const [contacts, setContacts] = useState<ContactRead[]>([]);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    safetyApi.listContacts().then(setContacts).catch(() => setContacts([]));

    if (!autoTrigger) return;
    (async () => {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {
        // fallback to ride's last known location on server
      }
      try {
        await safetyApi.triggerSos({
          ride_id: rideId,
          lat,
          lng,
          message: 'Emergency SOS triggered from NED Transport Hub mobile app',
        });
        setSent(true);
      } catch (err) {
        setError(getApiError(err, 'Could not reach server. Call 15 directly if in danger.'));
      }
    })();
  }, [rideId, autoTrigger]);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <View style={{ flex: 1, backgroundColor: colors.dangerSubtle }}>
      <Screen backgroundColor={colors.dangerSubtle}>
        <View style={styles.content}>
          <View style={styles.pulseOuter}>
            <View style={styles.pulseInner}>
              <Icon name="Siren" size={42} color={colors.white} />
            </View>
          </View>

          <Text style={styles.title}>
            {sent ? 'SOS Alert Sent' : 'Sending SOS Alert...'}
          </Text>
          <Text style={styles.sub}>
            Help is on the way. Stay calm and move to a safe, well-lit place.
          </Text>
          <Text style={styles.timer}>
            Live for {mins}:{secs}
          </Text>

          <ErrorBanner message={error} />

          <Card style={{ width: '100%', gap: 14 }}>
            <Text style={styles.cardHeading}>Notified</Text>
            <View style={styles.row}>
              <Icon name="CircleCheck" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>NED Campus Security & Admins</Text>
                <Text style={styles.contactSub}>Live location & vehicle details shared</Text>
              </View>
            </View>
            {contacts.map((c) => (
              <View key={c.id} style={styles.row}>
                <Icon name="CircleCheck" size={20} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactSub}>SMS sent to {c.phone}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </Screen>

      <Footer>
        <Button
          variant="danger"
          icon="Phone"
          onPress={() => Linking.openURL('tel:15')}
        >
          Call Police (15)
        </Button>
        <Button
          variant="secondary"
          onPress={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        >
          I am safe now
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 48, alignItems: 'center', gap: 14 },
  pulseOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(229,72,77,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.danger },
  sub: { fontSize: 14, color: colors.ink2, textAlign: 'center' },
  timer: { fontSize: 15, fontWeight: '700', color: colors.danger },
  cardHeading: { fontSize: 15, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  contactSub: { fontSize: 12, color: colors.ink2, marginTop: 1 },
});
