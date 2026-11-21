import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UploadFileAsset } from '../../api';
import { Badge, Button, Footer, Icon, Screen, TopBar } from '../../components/ui';
import { useRideFlow, type DriverDocDraft } from '../../context/RideFlowContext';
import { colors, radii } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDocs'>;
type DocKey = keyof DriverDocDraft;

export function DriverDocsScreen({ navigation, route }: Props) {
  const { driverDocs, setDriverDocs } = useRideFlow();
  const resubmitVehicleId = route.params?.resubmitVehicleId;

  const setDoc = (key: DocKey, asset: UploadFileAsset) => {
    setDriverDocs((prev) => ({ ...prev, [key]: asset }));
  };

  const pickFile = async (key: DocKey, useCamera: boolean) => {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Camera permission is needed to capture documents.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
        if (!res.canceled && res.assets[0]) {
          const a = res.assets[0];
          setDoc(key, {
            uri: a.uri,
            name: a.fileName ?? `${key}.jpg`,
            type: a.mimeType ?? 'image/jpeg',
          });
        }
      } else {
        const res = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });
        if (!res.canceled && res.assets[0]) {
          const a = res.assets[0];
          if (a.size && a.size > 5 * 1024 * 1024) {
            Alert.alert('File too large', 'Please choose a file smaller than 5 MB.');
            return;
          }
          setDoc(key, {
            uri: a.uri,
            name: a.name ?? `${key}.jpg`,
            type: a.mimeType ?? 'image/jpeg',
          });
        }
      }
    } catch {
      Alert.alert('Upload error', 'Could not select document. Please try again.');
    }
  };

  const promptPick = (key: DocKey, label: string) => {
    Alert.alert(`Upload ${label}`, 'Choose source', [
      { text: 'Camera', onPress: () => pickFile(key, true) },
      { text: 'Files / Gallery', onPress: () => pickFile(key, false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const items: { key: DocKey; title: string; sub: string }[] = [
    { key: 'licence', title: 'Driving Licence', sub: 'Valid car/bike licence (JPG/PNG/PDF)' },
    { key: 'registration', title: 'Vehicle Registration', sub: 'Registration book or smart card' },
    { key: 'universityId', title: 'NED Student / Staff ID', sub: 'Official NED University card' },
  ];

  const allSelected = Boolean(
    driverDocs.licence && driverDocs.registration && driverDocs.universityId,
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen>
        <TopBar title="Driver documents" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Text style={styles.step}>Step 1 of 2</Text>
          <Text style={styles.title}>Upload your documents</Text>
          <Text style={styles.sub}>Clear photos or PDFs (max 5 MB each) help us verify you faster.</Text>

          {items.map((item) => {
            const file = driverDocs[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.85}
                onPress={() => promptPick(item.key, item.title)}
                style={[styles.uploadCard, file && styles.uploadCardDone]}
              >
                <View style={styles.uploadTop}>
                  <Icon
                    name={file ? 'CircleCheck' : 'Upload'}
                    size={22}
                    color={file ? colors.success : colors.brand}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadTitle}>{item.title}</Text>
                    <Text style={styles.uploadSub} numberOfLines={1}>
                      {file ? file.name : item.sub}
                    </Text>
                  </View>
                  <Badge tone={file ? 'success' : 'neutral'}>
                    {file ? 'Selected' : 'Upload'}
                  </Badge>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.lockRow}>
            <Icon name="Lock" size={14} color={colors.ink2} />
            <Text style={styles.lockText}>
              Documents are stored securely and only reviewed by the NED admin team.
            </Text>
          </View>
        </View>
      </Screen>

      <Footer>
        <Button
          disabled={!resubmitVehicleId && !allSelected}
          onPress={() => navigation.navigate('DriverVehicle', { resubmitVehicleId })}
        >
          Continue
        </Button>
        <Text style={styles.footerHint}>Next: add your vehicle details</Text>
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  step: { fontSize: 13, fontWeight: '700', color: colors.brand },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2 },
  uploadCard: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentBright,
    backgroundColor: colors.brandSubtle,
    padding: 16,
  },
  uploadCardDone: {
    borderStyle: 'solid',
    borderColor: colors.success,
    backgroundColor: colors.successSubtle,
  },
  uploadTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uploadTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  uploadSub: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  lockRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  lockText: { flex: 1, fontSize: 12, color: colors.ink2 },
  footerHint: { textAlign: 'center', fontSize: 12, color: colors.ink3 },
});
