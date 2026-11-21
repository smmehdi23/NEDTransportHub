import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiError } from '../../api';
import { Button, ErrorBanner, Field, Icon, Screen, TopBar } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation, route }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your university email and password.');
      return;
    }
    setError(null);
    setNeedsVerify(false);
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err) {
      const msg = getApiError(err, 'Invalid email or password.');
      setError(msg);
      if (msg.toLowerCase().includes('not verified')) {
        setNeedsVerify(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <TopBar title="" onBack={() => navigation.navigate('Welcome')} />
      <View style={styles.content}>
        <View>
          <Text style={styles.title}>Welcome back,</Text>
          <Text style={styles.sub}>Sign in to ride</Text>
        </View>

        <ErrorBanner message={error} />

        {needsVerify ? (
          <Button
            variant="secondary"
            small
            onPress={() =>
              navigation.navigate('OtpVerify', {
                email: email.trim().toLowerCase(),
                purpose: 'verify_email',
              })
            }
          >
            Verify Email Now
          </Button>
        ) : null}

        <Field
          label="University email"
          icon="Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="name@cloud.neduet.edu.pk"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Field
          label="Password"
          icon="Lock"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>

        <View style={{ gap: 12, marginTop: 4 }}>
          <Button loading={loading} onPress={handleLogin}>
            Sign in
          </Button>
          <Button variant="secondary" onPress={() => navigation.navigate('Signup')}>
            Create account
          </Button>
        </View>

        <View style={styles.notice}>
          <Icon name="ShieldCheck" size={15} color={colors.ink3} />
          <Text style={styles.noticeText}>Only verified NED students and staff can join.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    fontSize: 15,
    color: colors.ink2,
    marginTop: 4,
  },
  forgot: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  noticeText: {
    fontSize: 12,
    color: colors.ink3,
  },
});
