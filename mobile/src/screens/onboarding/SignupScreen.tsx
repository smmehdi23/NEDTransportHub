import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi, getApiError } from '../../api';
import { DepartmentPickerModal } from '../../components/DepartmentPickerModal';
import { Button, ErrorBanner, Field, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii, shadows } from '../../theme';
import { validatePakistaniPhone } from '../../utils/validation';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [deptModal, setDeptModal] = useState(false);
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const passwordValid = hasLen && hasUpper && hasLower && hasDigit;

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim() || !normalizedEmail || !password) {
      setError('Please complete all required fields.');
      return;
    }
    if (!normalizedEmail.endsWith('@cloud.neduet.edu.pk')) {
      setError('Only @cloud.neduet.edu.pk email addresses can register.');
      return;
    }
    let normalizedPhone: string | undefined;
    if (phone.trim()) {
      const check = validatePakistaniPhone(phone);
      if (!check.valid) {
        setError(check.error ?? 'Enter a valid Pakistani phone number.');
        return;
      }
      normalizedPhone = check.normalized;
    }
    if (!department) {
      setError('Please select your NED University department (or Faculty / Admin Staff).');
      return;
    }
    if (!passwordValid) {
      setError('Password must be 8+ characters with an uppercase letter, lowercase letter, and number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        phone: normalizedPhone,
        department,
      });
      navigation.navigate('OtpVerify', {
        email: normalizedEmail,
        purpose: 'verify_email',
      });
    } catch (err) {
      setError(getApiError(err, 'Could not create account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Sign up" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.sub}>Join with your NED university email.</Text>

        <ErrorBanner message={error} />

        <Field
          label="Full name"
          icon="User"
          value={name}
          onChangeText={setName}
          placeholder="Hiba Saeed"
          autoCapitalize="words"
        />

        <Field
          label="University email"
          icon="Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="name@cloud.neduet.edu.pk"
          keyboardType="email-address"
          autoCapitalize="none"
          helper="Only @cloud.neduet.edu.pk emails are allowed"
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
            onPress={() => setDeptModal(true)}
            style={styles.pickerBox}
          >
            <Icon name="GraduationCap" size={20} color={colors.accentBright} />
            <Text
              style={[styles.pickerVal, !department && { color: colors.ink3 }]}
              numberOfLines={1}
            >
              {department || 'Select NED department or Faculty'}
            </Text>
            <Icon name="ChevronRight" size={18} color={colors.ink3} />
          </TouchableOpacity>
        </View>

        <Field
          label="Password"
          icon="Lock"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          helper="8+ chars, 1 uppercase, 1 lowercase, 1 number"
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setAgree(!agree)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, agree && styles.checkboxOn]}>
            {agree ? <Icon name="Check" size={14} color={colors.white} /> : null}
          </View>
          <Text style={styles.checkText}>I agree to the ride rules and privacy policy</Text>
        </TouchableOpacity>

        <Button disabled={!agree} loading={loading} onPress={handleRegister}>
          Create account
        </Button>

        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.bottomLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>

      <DepartmentPickerModal
        visible={deptModal}
        selected={department}
        onSelect={setDepartment}
        onClose={() => setDeptModal(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 15,
  },
  sub: {
    fontSize: 15,
    color: colors.ink2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    marginBottom: 6,
  },
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
  pickerVal: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink3,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    color: colors.ink2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 6,
  },
  bottomText: {
    fontSize: 14,
    color: colors.ink2,
  },
  bottomLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
});
