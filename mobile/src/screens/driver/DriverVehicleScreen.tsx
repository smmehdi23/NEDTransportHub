import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { driversApi, getApiError } from '../../api';
import { Button, ErrorBanner, Field, Footer, Icon, Screen, TopBar, type IconName } from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverVehicle'>;

export function DriverVehicleScreen({ navigation, route }: Props) {
  const resubmitVehicleId = route.params?.resubmitVehicleId;
  const { driverDocs, clearDriverDocs } = useRideFlow();

  const [vehicleType, setVehicleType] = useState<'Car' | 'Bike'>('Car');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!model.trim() || !plate.trim()) {
      setError('Please enter your vehicle make/model and plate number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fullModel = `${vehicleType} - ${model.trim()}`;
      if (resubmitVehicleId) {
        await driversApi.resubmitVehicle(resubmitVehicleId, {
          plate_number: plate.trim(),
          model: fullModel,
          seat_capacity: seats,
          licence_document: driverDocs.licence,
          registration_document: driverDocs.registration,
          university_id_document: driverDocs.universityId,
        });
      } else {
        if (!driverDocs.licence || !driverDocs.registration || !driverDocs.universityId) {
          setError('Please upload all three required documents in Step 1.');
          setLoading(false);
          return;
        }
        await driversApi.submitVehicle({
          plate_number: plate.trim(),
          model: fullModel,
          seat_capacity: seats,
          licence_document: driverDocs.licence,
          registration_document: driverDocs.registration,
          university_id_document: driverDocs.universityId,
        });
      }
      clearDriverDocs();
      Alert.alert(
        'Submitted for Review',
        'Your documents and vehicle details were sent to the NED transport admin team.',
      );
      navigation.replace('DriverStatus');
    } catch (err) {
      setError(getApiError(err, 'Could not submit vehicle for verification.'));
    } finally {
      setLoading(false);
    }
  };

  const types: ['Car' | 'Bike', IconName][] = [
    ['Car', 'Car'],
    ['Bike', 'Bike'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Add vehicle" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.step}>Step 2 of 2</Text>
          <ErrorBanner message={error} />

          <View style={styles.typeGrid}>
            {types.map(([label, icon]) => {
              const active = vehicleType === label;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    setVehicleType(label);
                    if (label === 'Bike') setSeats(1);
                    else if (seats < 2) setSeats(3);
                  }}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                >
                  <Icon
                    name={icon}
                    size={26}
                    color={active ? colors.brand : colors.ink2}
                  />
                  <Text style={[styles.typeText, active && { color: colors.brand }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Field
            label="Make and model"
            value={model}
            onChangeText={setModel}
            placeholder="Suzuki Cultus White"
          />

          <Field
            label="Plate number"
            value={plate}
            onChangeText={setPlate}
            placeholder="BKA-482"
            autoCapitalize="characters"
            helper="3-15 letters, digits or hyphens"
          />

          <View style={styles.seatBox}>
            <Text style={styles.seatLabel}>Seats you can offer</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                onPress={() => setSeats(Math.max(1, seats - 1))}
                style={styles.stepBtnLight}
              >
                <Icon name="Minus" size={16} color={colors.brand} />
              </TouchableOpacity>
              <Text style={styles.seatNum}>{seats}</Text>
              <TouchableOpacity
                onPress={() => setSeats(Math.min(8, seats + 1))}
                style={styles.stepBtnDark}
              >
                <Icon name="Plus" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button loading={loading} onPress={handleSubmit}>
          Submit for Review
        </Button>
        <Text style={styles.footerHint}>Usually approved within 24 hours</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  step: { fontSize: 13, fontWeight: '700', color: colors.brand },
  typeGrid: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  typeCardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
  },
  typeText: { fontSize: 15, fontWeight: '700', color: colors.ink2 },
  seatBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  seatLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtnLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNum: { fontSize: 17, fontWeight: '700', color: colors.ink, minWidth: 20, textAlign: 'center' },
  footerHint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
