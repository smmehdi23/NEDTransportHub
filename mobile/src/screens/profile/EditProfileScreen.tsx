import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, usersApi } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import {
  Avatar,
  Button,
  Card,
  ErrorBanner,
  Field,
  Footer,
  Icon,
  Screen,
  Toggle,
  TopBar,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, shadows } from '../../theme';
import { NED_DEPARTMENTS, validatePakistaniPhone } from '../../utils/validation';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useDialog();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [deptModal, setDeptModal] = useState(false);
  const [deptQuery, setDeptQuery] = useState('');
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

  const filteredDepts = NED_DEPARTMENTS.filter((d) =>
    d.toLowerCase().includes(deptQuery.trim().toLowerCase()),
  );

  const handleSave = async () => {
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    let normalizedPhone: string | null = null;
    if (phone.trim()) {
      const check = validatePakistaniPhone(phone);
      if (!check.valid) {
        setError(check.error ?? 'Enter a valid Pakistani mobile number.');
        return;
      }
      normalizedPhone = check.normalized ?? null;
    }
    if (department && !NED_DEPARTMENTS.includes(department as (typeof NED_DEPARTMENTS)[number])) {
      setError('Please select your official NED University department from the list.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await usersApi.updateMe({
        name: name.trim(),
        phone: normalizedPhone,
        department: department || null,
        ride_preferences: {
          quiet_ride: quietRide,
          music_allowed: musicAllowed,
          smoking_allowed: smokingAllowed,
          luggage_space_needed: luggageSpace,
        },
      });
      await refreshUser();
      showToast({ title: 'Profile updated', message: 'Your changes have been saved.', tone: 'success' });
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
            placeholder="+923001234567"
            keyboardType="phone-pad"
            helper="Pakistani mobile number (+923XXXXXXXXX or 03XXXXXXXXX)"
          />

          <View>
            <Text style={styles.fieldLabel}>Department (NED University)</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setDeptQuery('');
                setDeptModal(true);
              }}
              style={styles.pickerBox}
            >
              <Icon name="GraduationCap" size={20} color={colors.accentBright} />
              <Text
                style={[styles.pickerVal, !department && { color: colors.ink3 }]}
                numberOfLines={1}
              >
                {department || 'Select your NED department'}
              </Text>
              <Icon name="ChevronRight" size={18} color={colors.ink3} />
            </TouchableOpacity>
          </View>

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

      <Modal visible={deptModal} transparent animationType="slide" onRequestClose={() => setDeptModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select NED Department</Text>
              <TouchableOpacity onPress={() => setDeptModal(false)} style={{ padding: 4 }}>
                <Icon name="X" size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <Icon name="Search" size={16} color={colors.ink3} />
              <TextInput
                value={deptQuery}
                onChangeText={setDeptQuery}
                placeholder="Search department..."
                placeholderTextColor={colors.ink3}
                style={styles.searchInput}
              />
            </View>
            <FlatList
              data={filteredDepts}
              keyExtractor={(item) => item}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const active = department === item;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setDepartment(item);
                      setDeptModal(false);
                    }}
                    style={[styles.deptItem, active && styles.deptItemActive]}
                  >
                    <Text style={[styles.deptText, active && { color: colors.brand, fontWeight: '700' }]}>
                      {item}
                    </Text>
                    {active ? <Icon name="Check" size={18} color={colors.brand} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  avatarWrap: { alignItems: 'center', paddingVertical: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginBottom: 6 },
  pickerBox: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  pickerVal: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.ink },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,29,72,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  searchWrap: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  deptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  deptItemActive: { backgroundColor: colors.brandSubtle },
  deptText: { fontSize: 14, color: colors.ink },
});
