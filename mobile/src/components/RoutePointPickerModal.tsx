import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveMap } from './LiveMap';
import { Badge, Button, Icon } from './ui';
import { colors, radii, shadows } from '../theme';
import { projectOnRoute, type LatLngPoint } from '../utils/geo';

export interface RoutePickedPoint {
  name: string;
  lat: number;
  lng: number;
  progress: number;
  distanceM: number;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  route: LatLngPoint[];
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  initialPoint: { name: string; lat: number; lng: number };
  minProgress?: number;
  maxProgress?: number;
  maxDistanceM?: number;
  onConfirm: (point: RoutePickedPoint) => void;
  onClose: () => void;
}

export function RoutePointPickerModal({
  visible,
  title,
  subtitle,
  route,
  origin,
  destination,
  initialPoint,
  minProgress = 0,
  maxProgress = 1,
  maxDistanceM = 500,
  onConfirm,
  onClose,
}: Props) {
  const effectiveRoute: LatLngPoint[] = useMemo(
    () =>
      route.length >= 2
        ? route
        : [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ],
    [route, origin.lat, origin.lng, destination.lat, destination.lng],
  );

  const [lat, setLat] = useState(initialPoint.lat);
  const [lng, setLng] = useState(initialPoint.lng);
  const [label, setLabel] = useState(initialPoint.name);

  useEffect(() => {
    if (visible) {
      setLat(initialPoint.lat);
      setLng(initialPoint.lng);
      setLabel(initialPoint.name);
    }
  }, [visible, initialPoint.lat, initialPoint.lng, initialPoint.name]);

  const proj = useMemo(
    () => projectOnRoute([lat, lng], effectiveRoute),
    [lat, lng, effectiveRoute],
  );

  const withinCorridor = proj.distanceM <= maxDistanceM;
  const orderOk = proj.progress >= minProgress - 0.02 && proj.progress <= maxProgress + 0.02;
  const isValid = withinCorridor && orderOk;

  const midIdx = Math.floor(effectiveRoute.length / 2);
  const midPt = effectiveRoute[midIdx] ?? [(origin.lat + destination.lat) / 2, (origin.lng + destination.lng) / 2];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <LiveMap
          center={{ latitude: lat, longitude: lng }}
          route={effectiveRoute}
          markers={[
            {
              id: 'origin',
              latitude: origin.lat,
              longitude: origin.lng,
              title: `Start: ${origin.name}`,
              label: 'Start',
              tone: 'white',
            },
            {
              id: 'dest',
              latitude: destination.lat,
              longitude: destination.lng,
              title: `End: ${destination.name}`,
              label: 'End',
              tone: 'brand',
            },
            {
              id: 'picked',
              latitude: lat,
              longitude: lng,
              title: label || 'Selected point',
              tone: isValid ? 'success' : 'brand',
            },
          ]}
          onPressCoordinate={({ latitude, longitude }) => {
            setLat(latitude);
            setLng(longitude);
            setLabel(`Pinned stop (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }}
        />

        <SafeAreaView edges={['top']} style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.circleBtn}>
            <Icon name="ChevronLeft" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={styles.titlePill}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.statusRow}>
            <Badge tone={isValid ? 'success' : 'danger'}>
              {!withinCorridor
                ? `${proj.distanceM}m away (max ${maxDistanceM}m)`
                : !orderOk
                ? 'Must be in route direction'
                : `✓ ${proj.distanceM}m from route`}
            </Badge>
            <Text style={styles.pctText}>{Math.round(proj.progress * 100)}% along route</Text>
          </View>

          <Text style={styles.hint}>
            Tap anywhere within {maxDistanceM}m of the blue route line, or pick a quick point:
          </Text>

          <View style={styles.quickRow}>
            <TouchableOpacity
              onPress={() => {
                setLat(origin.lat);
                setLng(origin.lng);
                setLabel(origin.name);
              }}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setLat(midPt[0]);
                setLng(midPt[1]);
                setLabel(`Mid-route (${origin.name.split(',')[0]} → ${destination.name.split(',')[0]})`);
              }}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>Mid-route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setLat(destination.lat);
                setLng(destination.lng);
                setLabel(destination.name);
              }}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>Destination</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.nameWrap}>
            <Icon name="MapPin" size={16} color={colors.brand} />
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Landmark or stop name (e.g. Maskan Gate)"
              placeholderTextColor={colors.ink3}
              style={styles.nameInput}
            />
          </View>

          <Button
            disabled={!isValid || label.trim().length < 2}
            onPress={() =>
              onConfirm({
                name: label.trim(),
                lat,
                lng,
                progress: proj.progress,
                distanceM: proj.distanceM,
              })
            }
          >
            {isValid ? 'Confirm Point' : `Move pin within ${maxDistanceM}m of route`}
          </Button>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  titlePill: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...shadows.card,
  },
  titleText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  subText: { fontSize: 11, color: colors.ink2, marginTop: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
    ...shadows.sheet,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pctText: { fontSize: 12, fontWeight: '600', color: colors.ink2 },
  hint: { fontSize: 12, color: colors.ink2 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSubtle,
  },
  quickChipText: { fontSize: 12, fontWeight: '700', color: colors.brand },
  nameWrap: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    paddingHorizontal: 12,
  },
  nameInput: { flex: 1, fontSize: 13, color: colors.ink },
});
