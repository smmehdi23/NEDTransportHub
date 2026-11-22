import React, { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Icon, Logo, type IconName } from '../../components/ui';
import { colors, radii, shadows } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

interface OnboardingSlide {
  key: string;
  headingTop: string;
  headingAccent: string;
  desc: string;
  badgeIcon: IconName;
  badgeTitle: string;
  badgeSub: string;
  routeD: string;
  origin: [number, number];
  dest: [number, number];
  carPos: [number, number];
}

const SLIDES: OnboardingSlide[] = [
  {
    key: 'carpool',
    headingTop: 'Ride together',
    headingAccent: 'to campus',
    desc: 'Find verified NED classmates heading your way and split fuel costs fairly.',
    badgeIcon: 'MapPin',
    badgeTitle: 'NED University Routes',
    badgeSub: 'Daily campus carpools across Karachi',
    routeD: 'M70 410H109V250H273V110H328',
    origin: [70, 410],
    dest: [328, 110],
    carPos: [109, 320],
  },
  {
    key: 'verified',
    headingTop: 'Verified NED',
    headingAccent: 'community',
    desc: 'Only @cloud.neduet.edu.pk students, faculty, and admin-approved vehicles can join.',
    badgeIcon: 'ShieldCheck',
    badgeTitle: 'NED Verified Access',
    badgeSub: 'Licence, registration & NED ID checked',
    routeD: 'M41 322H181V182H273V110H328',
    origin: [41, 322],
    dest: [328, 110],
    carPos: [181, 250],
  },
  {
    key: 'safety',
    headingTop: 'Live GPS &',
    headingAccent: '24/7 SOS safety',
    desc: 'Track every trip live on the map and share your route with trusted contacts anytime.',
    badgeIcon: 'Siren',
    badgeTitle: 'Trusted Contact Sharing',
    badgeSub: 'Live location & instant SOS alert',
    routeD: 'M109 410V250H273V182H353',
    origin: [109, 410],
    dest: [353, 182],
    carPos: [273, 250],
  },
];

function FigmaMapFrame({ slide }: { slide: OnboardingSlide }) {
  const [ox, oy] = slide.origin;
  const [dx, dy] = slide.dest;
  const [cx, cy] = slide.carPos;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 390 500"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill}
    >
      {/* Official Figma Map frame.svg road grid */}
      <Rect width="390" height="500" fill="#142C5C" />
      <Rect y="70" width="390" height="4" fill="#2A4C8E" />
      <Rect y="180" width="390" height="4" fill="#2A4C8E" />
      <Rect y="320" width="390" height="4" fill="#2A4C8E" />
      <Rect y="460" width="390" height="4" fill="#2A4C8E" />
      <Rect x="39" width="4" height="500" fill="#2A4C8E" />
      <Rect x="179.4" width="4" height="500" fill="#2A4C8E" />
      <Rect x="351" width="4" height="500" fill="#2A4C8E" />

      <Rect y="103" width="390" height="14" fill="#2A4C8E" />
      <Rect y="243" width="390" height="14" fill="#2A4C8E" />
      <Rect y="403" width="390" height="14" fill="#2A4C8E" />
      <Rect x="102.2" width="14" height="500" fill="#2A4C8E" />
      <Rect x="266" width="14" height="500" fill="#2A4C8E" />

      {/* Highlighted route path */}
      <Path
        d={slide.routeD}
        stroke="#9CBDF2"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Origin pin */}
      <Circle cx={ox} cy={oy} r="7" fill="#142C5C" stroke="#9CBDF2" strokeWidth="4" />

      {/* Destination glowing pin */}
      <Circle cx={dx} cy={dy} r="23" fill="#9CBDF2" fillOpacity="0.22" />
      <Circle cx={dx} cy={dy} r="7" fill="#9CBDF2" stroke="#FFFFFF" strokeWidth="4" />

      {/* Clean circular car badge along route */}
      <Circle cx={cx} cy={cy} r="23" fill="#FFFFFF" />
      <Circle cx={cx} cy={cy} r="21" fill="none" stroke="#142C5C" strokeWidth="4" />
      <Path
        d={`M${cx - 8} ${cy + 2} L${cx - 6} ${cy - 4} H${cx + 3} L${cx + 7} ${cy + 1} H${cx + 8} V${cy + 5} H${cx - 8} Z`}
        fill="none"
        stroke="#142C5C"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={cx - 4.5} cy={cy + 5} r="1.8" fill="#142C5C" />
      <Circle cx={cx + 4.5} cy={cy + 5} r="1.8" fill="#142C5C" />
    </Svg>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const width = Dimensions.get('window').width;
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const currentSlide = SLIDES[activeIdx] ?? SLIDES[0];

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx >= 0 && idx < SLIDES.length) {
      setActiveIdx(idx);
    }
  };

  const goToSlide = (idx: number) => {
    setActiveIdx(idx);
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <FigmaMapFrame slide={currentSlide} />
        <SafeAreaView edges={['top']} style={styles.heroInner}>
          <Logo size={40} onDark />
          <View style={styles.featurePill}>
            <View style={styles.featureIcon}>
              <Icon name={currentSlide.badgeIcon} size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{currentSlide.badgeTitle}</Text>
              <Text style={styles.featureSub}>{currentSlide.badgeSub}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.carouselWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {SLIDES.map((s) => (
            <View key={s.key} style={[styles.slideBody, { width }]}>
              <Text style={styles.heading}>
                {s.headingTop}
                {'\n'}
                <Text style={{ color: colors.accentBright }}>{s.headingAccent}</Text>
              </Text>
              <Text style={styles.desc}>{s.desc}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dotsRow}>
          <View style={styles.dots}>
            {SLIDES.map((s, idx) => {
              const active = idx === activeIdx;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => goToSlide(idx)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  style={[styles.dot, active && styles.dotActive]}
                />
              );
            })}
          </View>
          {activeIdx < SLIDES.length - 1 ? (
            <TouchableOpacity onPress={() => goToSlide(activeIdx + 1)}>
              <Text style={styles.nextLink}>Next →</Text>
            </TouchableOpacity>
          ) : null}
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
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: 12,
    ...shadows.card,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  featureSub: {
    fontSize: 12,
    color: colors.ink2,
    marginTop: 1,
  },
  carouselWrap: {
    flex: 1,
    paddingTop: 24,
  },
  slideBody: {
    paddingHorizontal: 24,
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
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbdaf5',
  },
  dotActive: {
    width: 26,
    backgroundColor: colors.brand,
  },
  nextLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
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
