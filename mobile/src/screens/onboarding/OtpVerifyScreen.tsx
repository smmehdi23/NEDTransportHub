import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi, getApiError } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import { Button, ErrorBanner, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { email, purpose } = route.params;
  const { showToast } = useDialog();
  const isVerifyEmail = purpose === 'verify_email';

  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async () => {
    if (code.length < 6) return;
    setError(null);
    if (!isVerifyEmail) {
      navigation.navigate('ResetPassword', { email, otp: code });
      return;
    }
    setLoading(true);
    try {
      await authApi.verifyEmail({ email, otp: code });
      showToast({
        title: 'Email verified',
        message: 'Your NED account is verified. Please sign in to continue.',
        tone: 'success',
      });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: { email } }],
      });
    } catch (err) {
      setError(getApiError(err, 'Invalid or expired code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResending(true);
    try {
      if (isVerifyEmail) {
        await authApi.resendVerification(email);
      } else {
        await authApi.forgotPassword(email);
      }
      setSeconds(60);
    } catch (err) {
      setError(getApiError(err, 'Could not resend code.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <View style={styles.iconCircle}>
            <Icon
              name={isVerifyEmail ? 'MailCheck' : 'KeyRound'}
              size={34}
              color={colors.brand}
            />
          </View>
          <Text style={styles.title}>
            {isVerifyEmail ? 'Check your inbox' : 'Enter reset code'}
          </Text>
          <Text style={styles.sub}>Enter the 6-digit code we sent to {email}</Text>

          <ErrorBanner message={error} />

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={styles.otpContainer}
          >
            {Array.from({ length: 6 }).map((_, idx) => {
              const active = code.length === idx;
              return (
                <View key={idx} style={[styles.otpBox, active && styles.otpBoxActive]}>
                  <Text style={styles.otpDigit}>{code[idx] ?? ''}</Text>
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              style={styles.hiddenInput}
            />
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't get it? </Text>
            {seconds > 0 ? (
              <Text style={styles.resendWait}>
                Resend in 0:{String(seconds).padStart(2, '0')}
              </Text>
            ) : (
              <TouchableOpacity disabled={resending} onPress={handleResend}>
                <Text style={styles.resendBtn}>{resending ? 'Sending...' : 'Resend'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Screen>
      <Footer>
        <Button disabled={code.length < 6} loading={loading} onPress={handleSubmit}>
          {isVerifyEmail ? 'Verify Email' : 'Continue'}
        </Button>
        <Text style={styles.expiryNote}>Code expires in 10 minutes</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    maxWidth: 300,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    position: 'relative',
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: colors.brand,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
  resendRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  resendLabel: {
    fontSize: 14,
    color: colors.ink2,
  },
  resendWait: {
    fontSize: 14,
    color: colors.ink3,
  },
  resendBtn: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  expiryNote: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.ink3,
  },
});
