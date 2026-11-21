import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LiveMap } from '../../components/LiveMap';
import { Avatar, Badge, Card, TopBar } from '../../components/ui';
import { colors, shadows } from '../../theme';
import { formatPkr, formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ResultsMap'>;

export function ResultsMapScreen({ navigation, route }: Props) {
  const { matches } = route.params;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const active = matches[selectedIdx]?.ride;

  return (
    <View style={{ flex: 1 }}>
      <LiveMap
        center={
          active
            ? { latitude: active.origin_lat, longitude: active.origin_lng }
            : undefined
        }
        route={active?.route}
        markers={matches.map((m, idx) => ({
          id: String(m.ride.id),
          latitude: m.ride.origin_lat,
          longitude: m.ride.origin_lng,
          label: formatPkr(m.ride.estimated_fare),
          tone: idx === selectedIdx ? 'brand' : 'white',
          onPress: () => setSelectedIdx(idx),
        }))}
      />

      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <TopBar title="Rides near you" onBack={() => navigation.goBack()} />
      </SafeAreaView>

      {active ? (
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.sheetTitle}>{matches.length} rides available</Text>
              <Text style={styles.sheetSub}>
                {active.origin_name} → {active.destination_name}
              </Text>
            </View>
            <Badge tone="info">Map view</Badge>
          </View>
          <Card
            onPress={() =>
              navigation.navigate('RideDetails', { rideId: active.id, ride: active })
            }
            style={styles.rideCard}
          >
            <Avatar name={active.driver.name} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{active.driver.name}</Text>
              <Text style={styles.driverSub}>
                {formatTime(active.departure_time)} · {active.available_seats} seats left
              </Text>
            </View>
            <Text style={styles.fare}>{formatPkr(active.estimated_fare)}</Text>
          </Card>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
    ...shadows.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  sheetSub: {
    fontSize: 13,
    color: colors.ink2,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  driverSub: {
    fontSize: 12,
    color: colors.ink2,
  },
  fare: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
});
