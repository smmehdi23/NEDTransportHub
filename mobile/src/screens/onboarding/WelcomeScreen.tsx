import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar, Button, DecorativeMapBg, Logo } from '../../components/ui';
import { colors, radii, shadows } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <DecorativeMapBg dark />
        <SafeAreaView edges={['top']} style={styles.heroInner}>
          <Logo size={40} onDark />
          <View style={styles.previewCard}>
            <Avatar name="Ahmed Raza" size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle}>Ahmed is 3 min away</Text>
              <Text style={styles.previewSub}>White Cultus · BKA-482</Text>
            </View>
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>PKR 150</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>
          Ride together{'\n'}
          <Text style={{ color: colors.accentBright }}>to campus</Text>
        </Text>
        <Text style={styles.desc}>
          Find verified NED classmates heading your way and split the fuel cost.
        </Text>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.actions}>
        <Button icon="ArrowRight" onPress={() => navigation.navigate('Signup')}>
          Get Started
        </Button>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Login')}
          style={styles.secondaryLink}
        >
          <Text style={styles.secondaryLinkText}>I already have an account</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  hero: {
    height: '52%',
    backgroundColor: colors.brand,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  heroInner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 12,
    ...shadows.card,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  previewSub: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 2,
  },
  pricePill: {
    backgroundColor: colors.brandSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors.brand,
  },
  desc: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink2,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbdaf5',
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.brand,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    gap: 10,
  },
  secondaryLink: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
});
