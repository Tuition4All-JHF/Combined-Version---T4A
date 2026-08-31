import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, StatusBar, RefreshControl,
} from 'react-native';
import { adminApi } from '../../api/adminApi';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

export default function AdminSubjects() {
  const { colors } = useTheme();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [focused, setFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSubjects = () => {
    setLoading(true);
    adminApi.getSubjects().then((data) => {
      setSubjects(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const onRefresh = () => {
    setRefreshing(true);
    adminApi.getSubjects().then((data) => {
      setSubjects(data);
    }).catch(() => {}).finally(() => setRefreshing(false));
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeletingId(id);
            adminApi.deleteSubject(id)
              .then(() => fetchSubjects())
              .catch(() => Alert.alert('Error', 'Failed to delete subject.'))
              .finally(() => setDeletingId(null));
          }
        }
      ]
    );
  };

  useEffect(() => { fetchSubjects(); }, []);

  const handleAdd = () => {
    if (!newSubject.trim()) return;
    setAdding(true);
    adminApi.addSubject(newSubject.trim()).then(() => {
      setNewSubject('');
      fetchSubjects();
      Alert.alert('✅ Added', `"${newSubject.trim()}" has been added to the subject list.`);
    }).catch(() => {
      Alert.alert('Error', 'Failed to add subject');
    }).finally(() => setAdding(false));
  };

  const subjectColors = [
    colors.primary,
    colors.accent,
    colors.success,
    colors.info,
    colors.warning,
    '#FF6584',
    '#43C6AC',
  ];

  const s = createStyles(colors);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Manage Subjects</Text>
          <Text style={s.headerSub}>{subjects.length} subject{subjects.length !== 1 ? 's' : ''} on platform</Text>
        </View>
      </View>

      {/* Add subject input */}
      <View style={s.addSection}>
        <Text style={s.addLabel}>Add New Subject</Text>
        <View style={s.addRow}>
          <View style={[s.inputWrapper, focused && s.inputWrapperFocused]}>
            <Text style={s.inputIcon}>📚</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Advanced Mathematics"
              placeholderTextColor={colors.textMuted}
              value={newSubject}
              onChangeText={setNewSubject}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleAdd}
            />
          </View>
          <TouchableOpacity
            style={[s.addBtn, (!newSubject.trim() || adding) && s.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!newSubject.trim() || adding}
            activeOpacity={0.85}
          >
            {adding ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={s.addBtnText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Subjects list */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['8'] }} size="large" />
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing['3'] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTitle}>No subjects yet</Text>
              <Text style={s.emptyText}>Add the first subject using the form above.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const color = subjectColors[index % subjectColors.length];
            return (
              <View style={[s.subjectChip, { borderColor: color + '50', backgroundColor: color + '12' }]}>
                <View style={[s.chipDot, { backgroundColor: color }]} />
                <Text style={[s.subjectName, { color: color }]}>{item.name}</Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.name)}
                  style={s.deleteChipBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Text style={s.deleteChipText}>✕</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  headerSub: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },

  addSection: {
    margin: spacing['4'],
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  addLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    marginBottom: spacing['3'],
  },
  addRow: { flexDirection: 'row', gap: spacing['3'] },
  inputWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing['3'],
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  inputIcon: { fontSize: 16, marginRight: spacing['2'] },
  input: {
    flex: 1, fontSize: typography.size.sm,
    color: colors.text, paddingVertical: spacing['3'],
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['5'],
    justifyContent: 'center',
    borderRadius: radius.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  addBtnDisabled: { backgroundColor: colors.textMuted, shadowOpacity: 0 },
  addBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },

  listContent: { padding: spacing['4'], paddingTop: 0, paddingBottom: spacing['8'] },

  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 50, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['2'], textAlign: 'center' },

  subjectChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing['2'],
    borderRadius: radius.lg, padding: spacing['3'],
    borderWidth: 1.5, marginBottom: spacing['3'],
  },
  chipDot: { width: 8, height: 8, borderRadius: radius.full },
  subjectName: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, flex: 1 },
  deleteChipBtn: { padding: 2 },
  deleteChipText: { color: colors.error, fontSize: 14, fontWeight: typography.weight.bold },
});
