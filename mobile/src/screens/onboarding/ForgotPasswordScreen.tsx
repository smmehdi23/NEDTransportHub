import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi, getApiError } from '../../api';
import { Button, ErrorBanner, Field, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Enter your university email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      await authApi.forgotPassword(normalized);
      navigation.navigate('OtpVerify', {
        email: normalized,
        purpose: 'reset_password',
      });
    } catch (err) {
      setError(getApiError(err, 'Could not send reset code.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Forgot password" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.sub}>
            No worries. We will send a 6-digit reset code to your university email.
          </Text>
          <ErrorBanner message={error} />
          <Field
            label="University email"
            icon="Mail"
            value={email}
            onChangeText={setEmail}
            placeholder="name@cloud.neduet.edu.pk"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.infoBox}>
            <Icon name="ShieldCheck" size={18} color={colors.brand} />
            <Text style={styles.infoText}>
              For your security, the code works once and expires in 10 minutes.
            </Text>
          </View>
        </View>
      </Screen>
      <Footer>
        <Button loading={loading} onPress={handleSend}>
          Send Reset Code
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
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.md,
    padding: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.brand,
    lineHeight: 18,
  },
});
