import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Bike,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Headset,
  Heart,
  House,
  IdCard,
  KeyRound,
  LocateFixed,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Minus,
  Navigation,
  Phone,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SearchX,
  Send,
  Share2,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smartphone,
  Split,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  Users,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react-native';
import { colors, radii, shadows } from '../theme';

const ICONS = {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Bike,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Headset,
  Heart,
  House,
  IdCard,
  KeyRound,
  LocateFixed,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Minus,
  Navigation,
  Phone,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SearchX,
  Send,
  Share2,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smartphone,
  Split,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  Users,
  Wallet,
  WifiOff,
  X,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  fill,
}: {
  name: IconName;
  size?: number;
  color?: string;
  fill?: string;
}) {
  const Comp = ICONS[name] as React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
    fill?: string;
  }>;
  if (!Comp) return null;
  return <Comp size={size} color={color} strokeWidth={1.85} {...(fill ? { fill } : {})} />;
}

export function Logo({
  size = 40,
  onDark = false,
  wordmark = true,
}: {
  size?: number;
  onDark?: boolean;
  wordmark?: boolean;
}) {
  const bg = onDark ? '#FFFFFF' : '#091D48';
  const stroke = onDark ? '#142C5C' : '#FFFFFF';
  return (
    <View style={styles.logoRow}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Path
          d="M47.3486 0H16.6514C7.4551 0 0 7.4551 0 16.6514V47.3486C0 56.5449 7.4551 64 16.6514 64H47.3486C56.5449 64 64 56.5449 64 47.3486V16.6514C64 7.4551 56.5449 0 47.3486 0Z"
          fill={bg}
        />
        <Path
          d="M16.429 38.5144V24.8069C16.4289 23.7435 16.7631 22.7071 17.3841 21.844C18.0051 20.9808 18.8817 20.3347 19.8899 19.9968C20.8981 19.6589 21.987 19.6463 23.0027 19.9609C24.0184 20.2755 24.9096 20.9013 25.5504 21.7498L41.9317 43.4476C42.2407 43.857 42.6706 44.159 43.1606 44.3108C43.6506 44.4626 44.1759 44.4566 44.6623 44.2936C45.1486 44.1306 45.5715 43.8189 45.871 43.4025C46.1706 42.9861 46.3317 42.486 46.3316 41.9731V19.0348"
          stroke={stroke}
          strokeWidth={5.91}
          strokeLinejoin="round"
        />
        <Path
          d="M20.6237 43.2493C20.6237 45.5659 18.7456 47.4439 16.429 47.4439C14.1124 47.4439 12.2344 45.5659 12.2344 43.2493C12.2344 40.9326 14.1124 39.0546 16.429 39.0546C18.7456 39.0546 20.6237 40.9326 20.6237 43.2493Z"
          stroke={stroke}
          strokeWidth={3.37}
        />
        <Path
          d="M46.3317 24.1827C49.1748 24.1827 51.4796 21.8779 51.4796 19.0348C51.4796 16.1916 49.1748 13.8868 46.3317 13.8868C43.4885 13.8868 41.1837 16.1916 41.1837 19.0348C41.1837 21.8779 43.4885 24.1827 46.3317 24.1827Z"
          fill="#9CBDF2"
        />
      </Svg>
      {wordmark && (
        <View>
          <Text style={[styles.logoTitle, onDark && { color: colors.white }]}>NED Transport Hub</Text>
          <Text style={[styles.logoSub, onDark && { color: colors.accent }]}>
            Ride together to campus
          </Text>
        </View>
      )}
    </View>
  );
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  icon,
  small = false,
  disabled = false,
  loading = false,
  style,
}: {
  children?: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const variantContainer: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.brand, ...shadows.button },
    secondary: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.line,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.danger },
    light: { backgroundColor: colors.white },
  };
  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.white : colors.brand;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.buttonBase,
        small ? styles.buttonSmall : styles.buttonRegular,
        variantContainer[variant],
        isDisabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={textColor} /> : null}
          {children ? (
            <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: textColor }]}>
              {children}
            </Text>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

const badgeTones = {
  success: { bg: colors.successSubtle, fg: colors.success },
  warning: { bg: colors.warningSubtle, fg: colors.warning },
  danger: { bg: colors.dangerSubtle, fg: colors.danger },
  info: { bg: colors.brandSubtle, fg: colors.brand },
  neutral: { bg: colors.canvas, fg: colors.ink2 },
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
}) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function Chip({
  children,
  active,
  onPress,
}: {
  children: ReactNode;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: colors.brand, borderColor: colors.brand }
          : { backgroundColor: colors.white, borderColor: colors.line },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? colors.white : colors.ink2 }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

export function Avatar({
  name,
  size = 42,
  tone = 'brand',
}: {
  name: string;
  size?: number;
  tone?: 'brand' | 'accent';
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  const bg = tone === 'brand' ? colors.brandSubtle : 'rgba(156,189,242,0.35)';
  const fg = tone === 'brand' ? colors.brand : colors.warning;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: fg }}>{initials}</Text>
    </View>
  );
}

export function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'sentences',
  editable = true,
  multiline = false,
}: {
  label: string;
  icon?: IconName;
  value?: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ width: '100%' }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldBox,
          multiline && { height: 100, alignItems: 'flex-start', paddingVertical: 14 },
          error ? { borderWidth: 1.5, borderColor: colors.danger } : null,
          !editable ? { opacity: 0.7 } : null,
        ]}
      >
        {icon ? <Icon name={icon} size={20} color={colors.accentBright} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          style={[styles.fieldInput, multiline && { textAlignVertical: 'top', height: '100%' }]}
        />
      </View>
      {error || helper ? (
        <Text style={[styles.fieldHelper, error ? { color: colors.danger } : null]}>
          {error || helper}
        </Text>
      ) : null}
    </View>
  );
}

export function Toggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.line, true: colors.brand }}
      thumbColor={colors.white}
    />
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function TopBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onBack}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <Icon name="ChevronLeft" size={22} color={colors.ink} />
        </TouchableOpacity>
      ) : null}
      <Text style={styles.topBarTitle} numberOfLines={1}>
        {title}
      </Text>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
  backgroundColor = colors.canvas,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor }]} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ paddingBottom: 28 }, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.footer}>
      <View style={{ gap: 10 }}>{children}</View>
    </SafeAreaView>
  );
}

export function RouteRow({
  from,
  to,
  a,
  b,
}: {
  from: string;
  to: string;
  a?: string;
  b?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingTop: 5 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: colors.brand,
            backgroundColor: colors.white,
          }}
        />
        <View style={{ width: 1.5, flex: 1, backgroundColor: colors.line, marginVertical: 4 }} />
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.brand,
          }}
        />
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={styles.routePlace} numberOfLines={1}>
            {from}
          </Text>
          {a ? <Text style={styles.routeTime}>{a}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={styles.routePlace} numberOfLines={1}>
            {to}
          </Text>
          {b ? <Text style={styles.routeTime}>{b}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function Stars({ rating }: { rating: number | null | undefined }) {
  const display = rating !== null && rating !== undefined ? rating.toFixed(1) : 'New';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="Star" size={14} color={colors.accentBright} fill={colors.accent} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{display}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Icon name="CircleAlert" size={18} color={colors.danger} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

export function DecorativeMapBg({ dark = false }: { dark?: boolean }) {
  const blockColor = dark ? '#2a4c8e' : '#d6dfee';
  const lineColor = dark ? '#9cbdf2' : '#142c5c';
  const rects = [
    [6, 8, 26, 22],
    [40, 6, 24, 18],
    [72, 10, 22, 26],
    [8, 42, 22, 20],
    [38, 40, 26, 24],
    [72, 46, 22, 18],
    [10, 72, 28, 20],
    [46, 72, 22, 22],
    [76, 74, 18, 18],
  ];
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {rects.map(([x, y, w, h], idx) => (
        <Rect key={idx} x={x} y={y} width={w} height={h} rx={2} fill={blockColor} />
      ))}
      <Path
        d="M12 88 C 30 70, 40 62, 52 50 S 78 30, 88 14"
        stroke={lineColor}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  logoSub: {
    fontSize: 10,
    color: colors.ink3,
    marginTop: 1,
  },
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.xxl,
  },
  buttonRegular: {
    height: 50,
    paddingHorizontal: 20,
    width: '100%',
  },
  buttonSmall: {
    height: 38,
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    marginBottom: 6,
  },
  fieldBox: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  fieldHelper: {
    fontSize: 12,
    color: colors.ink3,
    marginTop: 5,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    ...shadows.card,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  routePlace: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  routeTime: {
    fontSize: 13,
    color: colors.ink3,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerSubtle,
    borderRadius: radii.md,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.danger,
  },
});
