import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Footer, Icon, Screen, TopBar, type IconName } from '../../components/ui';
import { colors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BecomeDriver'>;

export function BecomeDriverScreen({ navigation }: Props) {
  const needs: [string, string, IconName][] = [
    ['Driving licence', 'Clear photo or PDF (max 5 MB)', 'IdCard'],
    ['Vehicle registration', 'Car or bike in your name or family', 'FileText'],
    ['NED student or staff ID', 'Verified by admin within 24 hours', 'GraduationCap'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Become a driver" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.heading}>Drive to campus,{'\n'}split your fuel cost</Text>
          <Text style={styles.sub}>
            Offer empty seats to verified NED students and staff heading along your route.
          </Text>

          <View style={styles.statsRow}>
            <Card style={{ flex: 1 }}>
              <Text style={styles.statNum}>PKR 4,500</Text>
              <Text style={styles.statSub}>avg. saved / month</Text>
            </Card>
            <Card style={{ flex: 1 }}>
              <Text style={styles.statNum}>Up to 8</Text>
              <Text style={styles.statSub}>seats configurable</Text>
            </Card>
          </View>

          <Text style={styles.sectionTitle}>What you need</Text>
          {needs.map(([title, desc, icon]) => (
            <Card key={title} style={styles.itemRow}>
              <View style={styles.iconBox}>
                <Icon name={icon} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemSub}>{desc}</Text>
              </View>
            </Card>
          ))}
        </View>
      </Screen>
      <Footer>
        <Button icon="ArrowRight" onPress={() => navigation.navigate('DriverDocs')}>
          Start Verification
        </Button>
        <Text style={styles.footerHint}>Takes about 5 minutes</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  heading: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statNum: { fontSize: 20, fontWeight: '700', color: colors.brand },
  statSub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  itemSub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  footerHint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
