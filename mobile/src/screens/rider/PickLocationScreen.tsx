import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { mapsApi, type CampusGatesResponse, type GeocodeResult } from '../../api';
import { LiveMap } from '../../components/LiveMap';
import { Button, Chip, Icon } from '../../components/ui';
import { KARACHI_PRESETS } from '../../config/env';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii, shadows } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PickLocation'>;

export function PickLocationScreen({ navigation, route }: Props) {
  const { target, returnTo } = route.params;
  const { pickup, dropoff, setPickup, setDropoff } = useRideFlow();
  const initial = target === 'pickup' ? pickup : dropoff;

  const [selected, setSelected] = useState(initial);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [gates, setGates] = useState<CampusGatesResponse | null>(null);

  useEffect(() => {
    mapsApi.getCampusGates().then(setGates).catch(() => null);
  }, []);

  const getLocalMatches = useCallback((raw: string): GeocodeResult[] => {
    const q = raw.trim().toLowerCase();
    if (q.length < 2) return [];
    return KARACHI_PRESETS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q),
    )
      .slice(0, 5)
      .map((p) => ({ name: `${p.name} — ${p.area}`, lat: p.lat, lng: p.lng }));
  }, []);

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const q = rawQuery.trim();
      if (q.length < 2) {
        setResults([]);
        setSearchedOnce(false);
        return;
      }
      const localMatches = getLocalMatches(q);
      if (localMatches.length > 0) {
        setResults(localMatches);
      }
      setSearching(true);
      try {
        const remote = await mapsApi.geocode(q);
        const merged: GeocodeResult[] = [...localMatches];
        for (const r of remote) {
          const dup = merged.some(
            (m) => Math.abs(m.lat - r.lat) < 0.0015 && Math.abs(m.lng - r.lng) < 0.0015,
          );
          if (!dup) merged.push(r);
        }
        setResults(merged.slice(0, 6));
        setSearchedOnce(true);
      } catch {
        setResults(localMatches);
        setSearchedOnce(true);
      } finally {
        setSearching(false);
      }
    },
    [getLocalMatches],
  );

  // Live debounced search as the user types
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchedOnce(false);
      return;
    }
    const instant = getLocalMatches(q);
    if (instant.length > 0) setResults(instant);

    const timer = setTimeout(() => {
      runSearch(q);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, getLocalMatches, runSearch]);

  const handleGeocode = () => {
    Keyboard.dismiss();
    runSearch(search);
  };

  const handleUseGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    setSelected({
      name: 'Current GPS Location',
      subtitle: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
  };

  const handleConfirm = () => {
    if (target === 'pickup') {
      setPickup(selected);
    } else {
      setDropoff(selected);
    }
    if (returnTo === 'SearchResults') {
      navigation.navigate('SearchResults', {
        pickupLat: target === 'pickup' ? selected.lat : pickup.lat,
        pickupLng: target === 'pickup' ? selected.lng : pickup.lng,
        dropoffLat: target === 'dropoff' ? selected.lat : dropoff.lat,
        dropoffLng: target === 'dropoff' ? selected.lng : dropoff.lng,
        pickupName: target === 'pickup' ? selected.name : pickup.name,
        dropoffName: target === 'dropoff' ? selected.name : dropoff.name,
      });
    } else {
      navigation.goBack();
    }
  };

  const quickChips = [
    ...KARACHI_PRESETS.slice(0, 4).map((p) => ({
      name: p.name,
      subtitle: p.area,
      lat: p.lat,
      lng: p.lng,
    })),
    ...(gates?.gates ?? []).map((g) => ({
      name: `NED ${g.name}`,
      subtitle: 'Approved night pickup gate',
      lat: g.lat,
      lng: g.lng,
    })),
  ];

  return (
    <View style={{ flex: 1 }}>
      <LiveMap
        center={{ latitude: selected.lat, longitude: selected.lng }}
        markers={[
          {
            id: 'selected',
            latitude: selected.lat,
            longitude: selected.lng,
            title: selected.name,
            tone: 'brand',
          },
        ]}
        onPressCoordinate={({ latitude, longitude }) =>
          setSelected({
            name: 'Pinned Location',
            subtitle: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude,
            lng: longitude,
          })
        }
      />

      <SafeAreaView edges={['top']} style={styles.topOverlay}>
        <View style={styles.searchBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle}>
            <Icon name="ChevronLeft" size={18} color={colors.brand} />
          </TouchableOpacity>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search area or landmark"
            placeholderTextColor={colors.ink3}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={handleGeocode}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : search.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setResults([]);
                setSearchedOnce(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="X" size={18} color={colors.ink3} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleGeocode}>
              <Icon name="Search" size={18} color={colors.brand} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleUseGps} style={styles.gpsBtn}>
            <Icon name="LocateFixed" size={18} color={colors.brand} />
          </TouchableOpacity>
        </View>

        {results.length > 0 ? (
          <View style={styles.dropdown}>
            {results.slice(0, 6).map((r, idx) => (
              <TouchableOpacity
                key={`${r.name}-${idx}`}
                style={styles.dropdownRow}
                onPress={() => {
                  Keyboard.dismiss();
                  const [shortTitle, ...rest] = r.name.split(/—|,/);
                  setSelected({
                    name: shortTitle.trim() || r.name,
                    subtitle: rest.join(',').trim() || `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`,
                    lat: r.lat,
                    lng: r.lng,
                  });
                  setResults([]);
                  setSearch('');
                  setSearchedOnce(false);
                }}
              >
                <Icon name="MapPin" size={16} color={colors.brand} />
                <Text style={styles.dropdownText} numberOfLines={2}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : searchedOnce && !searching && search.trim().length >= 2 ? (
          <View style={styles.dropdown}>
            <View style={styles.dropdownRow}>
              <Icon name="SearchX" size={16} color={colors.ink3} />
              <Text style={[styles.dropdownText, { color: colors.ink2 }]}>
                No places found for "{search.trim()}". Try another Karachi area or tap directly on the map.
              </Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <View>
          <Text style={styles.pointLabel}>
            {target === 'pickup' ? 'Pickup point' : 'Drop-off point'}
          </Text>
          <Text style={styles.pointTitle}>{selected.name}</Text>
          <Text style={styles.pointSub}>
            {selected.subtitle || `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {quickChips.map((c) => (
            <Chip
              key={c.name}
              active={selected.name === c.name}
              onPress={() => setSelected(c)}
            >
              {c.name}
            </Chip>
          ))}
        </ScrollView>

        {gates?.rule_enabled ? (
          <View style={styles.nightRule}>
            <Icon name="Clock" size={16} color={colors.accentBright} />
            <Text style={styles.nightRuleText}>
              Between {gates.night_start_hour}:00 and {gates.night_end_hour}:00, campus pickups must
              be within {gates.gate_radius_m} m of an NED gate.
            </Text>
          </View>
        ) : null}

        <Button icon="ArrowRight" onPress={handleConfirm}>
          Confirm {target === 'pickup' ? 'Pickup' : 'Drop-off'}
        </Button>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 20,
    elevation: 10,
  },
  searchBar: {
    marginTop: 8,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.card,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
  },
  gpsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: 6,
    ...shadows.card,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
    ...shadows.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink2,
  },
  pointTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
  },
  pointSub: {
    fontSize: 13,
    color: colors.ink2,
    marginTop: 2,
  },
  nightRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    padding: 12,
    borderRadius: radii.md,
  },
  nightRuleText: {
    flex: 1,
    fontSize: 12,
    color: colors.ink2,
  },
});
