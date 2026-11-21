import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi, getApiError } from '../../api';
import { Button, ErrorBanner, Field, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { email, otp } = route.params;
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules: [string, boolean][] = [
    ['8+ characters', pw.length >= 8],
    ['1 uppercase', /[A-Z]/.test(pw)],
    ['1 lowercase', /[a-z]/.test(pw)],
    ['1 number', /\d/.test(pw)],
  ];
  const ok = rules.every((r) => r[1]) && pw === confirm;

  const handleReset = async () => {
    if (!ok) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword({ email, otp, new_password: pw });
      Alert.alert('Password updated', 'Please sign in with your new password.');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: { email } }],
      });
    } catch (err) {
      setError(getApiError(err, 'Could not reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Reset password" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.sub}>Choose something strong you have not used before.</Text>
          <ErrorBanner message={error} />
          <Field
            label="New password"
            icon="Lock"
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            autoCapitalize="none"
          />
          <Field
            label="Confirm password"
            icon="Lock"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            error={confirm && pw !== confirm ? 'Passwords do not match' : undefined}
          />
          <View style={styles.rulesWrap}>
            {rules.map(([label, valid]) => (
              <View
                key={label}
                style={[
                  styles.rulePill,
                  { backgroundColor: valid ? colors.successSubtle : colors.white },
                ]}
              >
                <Icon
                  name={valid ? 'Check' : 'X'}
                  size={12}
                  color={valid ? colors.success : colors.ink3}
                />
                <Text
                  style={[
                    styles.ruleText,
                    { color: valid ? colors.success : colors.ink3 },
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Screen>
      <Footer>
        <Button disabled={!ok} loading={loading} onPress={handleReset}>
          Update Password
        </Button>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 14,
    color: colors.ink2,
  },
  rulesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  ruleText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
