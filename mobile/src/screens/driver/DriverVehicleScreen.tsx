import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { driversApi, getApiError } from '../../api';
import { useDialog } from '../../components/DialogProvider';
import {
  Button,
  Chip,
  ErrorBanner,
  Field,
  Footer,
  Icon,
  Screen,
  TopBar,
  type IconName,
} from '../../components/ui';
import { useRideFlow } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import {
  BIKE_PRESETS,
  CAR_PRESETS,
  validatePakistaniPlate,
  validateVehicleModel,
} from '../../utils/validation';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverVehicle'>;

export function DriverVehicleScreen({ navigation, route }: Props) {
  const resubmitVehicleId = route.params?.resubmitVehicleId;
  const { driverDocs, clearDriverDocs } = useRideFlow();
  const { showAlert } = useDialog();

  const [vehicleType, setVehicleType] = useState<'Car' | 'Bike'>('Car');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [seats, setSeats] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSeats = vehicleType === 'Bike' ? 1 : 6;
  const presets = vehicleType === 'Bike' ? BIKE_PRESETS : CAR_PRESETS;

  const handleSubmit = async () => {
    const modelCheck = validateVehicleModel(model);
    if (!modelCheck.valid || !modelCheck.normalized) {
      setError(modelCheck.error ?? 'Enter a valid vehicle make and model.');
      return;
    }
    const plateCheck = validatePakistaniPlate(plate);
    if (!plateCheck.valid || !plateCheck.normalized) {
      setError(plateCheck.error ?? 'Enter a valid Pakistani plate number (e.g. BKA-482).');
      return;
    }
    if (vehicleType === 'Bike' && seats > 1) {
      setError('A bike can offer at most 1 seat.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const fullModel = `${vehicleType} - ${modelCheck.normalized}`;
      if (resubmitVehicleId) {
        await driversApi.resubmitVehicle(resubmitVehicleId, {
          plate_number: plateCheck.normalized,
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
          plate_number: plateCheck.normalized,
          model: fullModel,
          seat_capacity: seats,
          licence_document: driverDocs.licence,
          registration_document: driverDocs.registration,
          university_id_document: driverDocs.universityId,
        });
      }
      clearDriverDocs();
      showAlert({
        title: 'Submitted for Review',
        message: 'Your documents and vehicle details were sent to the NED transport admin team.',
        tone: 'success',
        onClose: () => navigation.replace('DriverStatus'),
      });
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
                    setModel('');
                    setSeats(label === 'Bike' ? 1 : 3);
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
            placeholder={vehicleType === 'Bike' ? 'Honda CD-70' : 'Suzuki Cultus White'}
            helper="Include make & model (or pick a common vehicle below)"
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {presets.map((p) => (
              <Chip key={p} active={model === p} onPress={() => setModel(p)}>
                {p}
              </Chip>
            ))}
          </ScrollView>

          <Field
            label="Plate number"
            value={plate}
            onChangeText={(v) => setPlate(v.toUpperCase())}
            placeholder="BKA-482"
            autoCapitalize="characters"
            helper="Pakistani plate format: 2-4 letters + digits (e.g. BKA-482, ABC-1234)"
          />

          <View style={styles.seatBox}>
            <View>
              <Text style={styles.seatLabel}>Seats you can offer</Text>
              <Text style={styles.seatHint}>
                {vehicleType === 'Bike' ? 'Bikes can offer 1 pillion seat max' : 'Cars: 1 to 6 seats'}
              </Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                disabled={seats <= 1}
                onPress={() => setSeats(Math.max(1, seats - 1))}
                style={[styles.stepBtnLight, seats <= 1 && { opacity: 0.4 }]}
              >
                <Icon name="Minus" size={16} color={colors.brand} />
              </TouchableOpacity>
              <Text style={styles.seatNum}>{seats}</Text>
              <TouchableOpacity
                disabled={seats >= maxSeats}
                onPress={() => setSeats(Math.min(maxSeats, seats + 1))}
                style={[styles.stepBtnDark, seats >= maxSeats && { opacity: 0.4 }]}
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
  content: { paddingHorizontal: 20, gap: 14 },
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
  seatHint: { fontSize: 11, color: colors.ink3, marginTop: 2 },
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
