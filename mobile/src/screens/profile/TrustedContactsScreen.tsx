import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError, safetyApi, type ContactRead } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import {
  Avatar,
  Button,
  Card,
  ErrorBanner,
  Field,
  Icon,
  Screen,
  TopBar,
} from '../../components/ui';
import { colors } from '../../theme';
import { validatePakistaniPhone } from '../../utils/validation';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TrustedContacts'>;

export function TrustedContactsScreen({ navigation }: Props) {
  const { showConfirm, showToast } = useDialog();
  const [contacts, setContacts] = useState<ContactRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await safetyApi.listContacts();
      setContacts(list);
    } catch (err) {
      setError(getApiError(err, 'Could not load trusted contacts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleAdd = async () => {
    if (name.trim().length < 2) {
      setError('Enter a contact name (at least 2 characters).');
      return;
    }
    const phoneCheck = validatePakistaniPhone(phone);
    if (!phoneCheck.valid || !phoneCheck.normalized) {
      setError(phoneCheck.error ?? 'Enter a valid Pakistani mobile number (+923XXXXXXXXX).');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await safetyApi.addContact({ name: name.trim(), phone: phoneCheck.normalized });
      setName('');
      setPhone('');
      setShowAdd(false);
      showToast({ title: 'Contact added', message: `${name.trim()} saved as trusted contact.` });
      load();
    } catch (err) {
      setError(getApiError(err, 'Could not add trusted contact.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: ContactRead) => {
    showConfirm({
      title: 'Remove contact?',
      message: `Remove ${c.name} (${c.phone}) from your emergency contacts?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await safetyApi.deleteContact(c.id);
          showToast({ title: 'Contact removed', tone: 'info' });
          load();
        } catch (err) {
          setError(getApiError(err, 'Could not delete contact.'));
        }
      },
    });
  };

  return (
    <Screen>
      <TopBar title="Trusted contacts" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.sub}>
          If you share a trip or trigger SOS, these people receive your live location and vehicle
          details by SMS.
        </Text>

        <ErrorBanner message={error} />

        {loading ? (
          <ActivityIndicator size="large" color={colors.brand} style={{ marginTop: 28 }} />
        ) : (
          contacts.map((c) => (
            <Card key={c.id} style={styles.row}>
              <Avatar name={c.name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.phone}>{c.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(c)} style={styles.delBtn}>
                <Icon name="Trash2" size={18} color={colors.danger} />
              </TouchableOpacity>
            </Card>
          ))
        )}

        {showAdd ? (
          <Card style={{ gap: 12 }}>
            <Text style={styles.name}>Add trusted contact</Text>
            <Field label="Name" value={name} onChangeText={setName} placeholder="e.g., Mother" />
            <Field
              label="Pakistani mobile number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+923001234567"
              keyboardType="phone-pad"
              helper="Must start with +923 or 03 (e.g. +923001234567)"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                small
                variant="secondary"
                onPress={() => {
                  setError(null);
                  setShowAdd(false);
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button small loading={saving} onPress={handleAdd} style={{ flex: 1 }}>
                Save Contact
              </Button>
            </View>
          </Card>
        ) : (
          <Button
            variant="secondary"
            icon="Plus"
            disabled={contacts.length >= 5}
            onPress={() => setShowAdd(true)}
          >
            Add trusted contact
          </Button>
        )}

        <Text style={styles.hint}>You can save up to 5 emergency contacts.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  sub: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  phone: { fontSize: 13, color: colors.ink2, marginTop: 2 },
  delBtn: { padding: 8 },
  hint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
