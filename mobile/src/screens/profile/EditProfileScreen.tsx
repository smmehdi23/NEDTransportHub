import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, usersApi } from '../../api';
import {
  Avatar,
  Button,
  Card,
  ErrorBanner,
  Field,
  Footer,
  Screen,
  Toggle,
  TopBar,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [quietRide, setQuietRide] = useState(user?.ride_preferences?.quiet_ride ?? false);
  const [musicAllowed, setMusicAllowed] = useState(user?.ride_preferences?.music_allowed ?? true);
  const [smokingAllowed, setSmokingAllowed] = useState(
    user?.ride_preferences?.smoking_allowed ?? false,
  );
  const [luggageSpace, setLuggageSpace] = useState(
    user?.ride_preferences?.luggage_space_needed ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await usersApi.updateMe({
        name: name.trim(),
        phone: phone.trim() || null,
        department: department.trim() || null,
        ride_preferences: {
          quiet_ride: quietRide,
          music_allowed: musicAllowed,
          smoking_allowed: smokingAllowed,
          luggage_space_needed: luggageSpace,
        },
      });
      await refreshUser();
      Alert.alert('Profile updated', 'Your changes have been saved.');
      navigation.goBack();
    } catch (err) {
      setError(getApiError(err, 'Could not update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Edit profile" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <View style={styles.avatarWrap}>
            <Avatar name={name || 'NED User'} size={80} />
          </View>

          <ErrorBanner message={error} />

          <Field label="Full name" icon="User" value={name} onChangeText={setName} />
          <Field
            label="University email"
            icon="Mail"
            value={user?.email ?? ''}
            editable={false}
            helper="Verified NED University email cannot be changed"
          />
          <Field
            label="Phone number"
            icon="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            helper="Used for SOS and trip sharing"
          />
          <Field
            label="Department"
            icon="GraduationCap"
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g., Computer Systems Engineering"
          />

          <Card style={{ gap: 14 }}>
            <Text style={styles.sectionTitle}>Ride preferences</Text>
            {(
              [
                ['Quiet ride preferred', quietRide, setQuietRide],
                ['Music allowed', musicAllowed, setMusicAllowed],
                ['Smoking allowed', smokingAllowed, setSmokingAllowed],
                ['Need luggage space', luggageSpace, setLuggageSpace],
              ] as [string, boolean, (v: boolean) => void][]
            ).map(([label, val, setter]) => (
              <View key={label} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Toggle value={val} onValueChange={setter} />
              </View>
            ))}
          </Card>
        </View>
      </Screen>

      <Footer>
        <Button loading={saving} onPress={handleSave}>
          Save Changes
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  avatarWrap: { alignItems: 'center', paddingVertical: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
