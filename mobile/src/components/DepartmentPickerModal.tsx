import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from './ui';
import { colors, radii } from '../theme';
import { FACULTY_OPTION, NED_DEPARTMENTS } from '../utils/validation';

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (dept: string) => void;
  onClose: () => void;
}

export function DepartmentPickerModal({ visible, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = NED_DEPARTMENTS.filter((d) => d.toLowerCase().includes(q));

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Select NED Department</Text>
              <Text style={styles.sub}>Official NEDUET departments · Faculty / Admin Staff at bottom</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Icon name="X" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Icon name="Search" size={16} color={colors.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search department (e.g. CIS, Software, Civil, Faculty)..."
              placeholderTextColor={colors.ink3}
              style={styles.searchInput}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Icon name="X" size={15} color={colors.ink3} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            style={{ maxHeight: 400 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>
                No matching NED department found. Choose from the official list or select Faculty / Admin Staff.
              </Text>
            }
            renderItem={({ item }) => {
              const active = selected === item;
              const isFaculty = item === FACULTY_OPTION;
              return (
                <View>
                  {isFaculty && !q ? <View style={styles.facultyDivider} /> : null}
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(item);
                      handleClose();
                    }}
                    style={[
                      styles.item,
                      isFaculty && styles.facultyItem,
                      active && styles.itemActive,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.itemText,
                          isFaculty && styles.facultyText,
                          active && { color: colors.brand, fontWeight: '700' },
                        ]}
                      >
                        {item}
                      </Text>
                      {isFaculty ? (
                        <Text style={styles.facultySub}>
                          For NED faculty members, teachers & university admin staff
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Icon name="Check" size={18} color={colors.brand} /> : null}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,29,72,0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 11, color: colors.ink3, marginTop: 2 },
  closeBtn: { padding: 4 },
  searchWrap: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  empty: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.ink3,
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  facultyDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  facultyItem: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemActive: { backgroundColor: colors.brandSubtle, borderColor: colors.brand },
  itemText: { fontSize: 14, color: colors.ink },
  facultyText: { fontWeight: '700', color: colors.brand },
  facultySub: { fontSize: 11, color: colors.ink2, marginTop: 2 },
});
