import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Logo } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => {
      navigation.replace(isAuthenticated ? 'MainTabs' : 'Welcome');
    }, 900);
    return () => clearTimeout(t);
  }, [isLoading, isAuthenticated, navigation]);

  return (
    <LinearGradient colors={[colors.brand, colors.brandStrong]} style={styles.container}>
      <View style={styles.center}>
        <Logo size={96} onDark wordmark={false} />
        <Text style={styles.title}>NED Transport Hub</Text>
        <Text style={styles.sub}>Ride together to campus</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      </View>
      <Text style={styles.footer}>NED University of Engineering & Technology</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  title: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    color: colors.accent,
  },
  footer: {
    position: 'absolute',
    bottom: 42,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
});
