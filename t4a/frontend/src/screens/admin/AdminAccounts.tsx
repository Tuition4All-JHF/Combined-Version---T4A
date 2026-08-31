import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, RefreshControl, Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminApi } from '../../api/adminApi';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeContext';

export default function AdminAccounts() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'STUDENT' | 'TUTOR' | 'PARENT'>('ALL');

  const fetchAccounts = async () => {
    try {
      const data = await adminApi.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAccounts().finally(() => setRefreshing(false));
  }, []);

  const handleToggleFreeze = async (id: number) => {
    try {
      const res = await adminApi.toggleFreezeAccount(id);
      if (res.status === 'success') {
        setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, is_frozen: res.is_frozen } : acc));
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to toggle account status');
    }
  };

  const s = createStyles(colors);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Loading accounts...</Text>
      </View>
    );
  }

  const filteredAccounts = accounts.filter(acc => filter === 'ALL' || acc.role?.toUpperCase() === filter || (filter === 'TUTOR' && acc.role?.toLowerCase() === 'teacher'));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Manage Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.filterRow}>
        {['ALL', 'STUDENT', 'TUTOR', 'PARENT'].map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase() + 's'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filteredAccounts.map(acc => (
          <View key={acc.id} style={s.accountCard}>
            <View style={s.accountHeader}>
              <View>
                <Text style={s.accountName}>{acc.first_name ? `${acc.first_name} ${acc.last_name || ''}`.trim() : acc.username}</Text>
                <Text style={s.accountEmail}>{acc.email}</Text>
              </View>
              <View style={[s.roleBadge, { backgroundColor: getRoleColor(acc.role, colors) }]}>
                <Text style={s.roleBadgeText}>{acc.role === 'teacher' ? 'TUTOR' : acc.role?.toUpperCase()}</Text>
              </View>
            </View>

            {acc.role === 'PARENT' && acc.linked_students && acc.linked_students.length > 0 && (
              <View style={s.linkedStudents}>
                <Text style={s.linkedTitle}>Linked Students:</Text>
                {acc.linked_students.map((student: any) => (
                  <Text key={student.id} style={s.linkedStudentText}>• {student.first_name ? `${student.first_name} ${student.last_name || ''}`.trim() : student.username}</Text>
                ))}
              </View>
            )}

            <View style={s.actionRow}>
              <Text style={[s.statusText, acc.is_frozen ? s.statusFrozen : s.statusActive]}>
                Status: {acc.is_frozen ? 'Frozen' : 'Active'}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
                {acc.role !== 'ADMIN' && (
                  <TouchableOpacity
                    style={s.viewProfileBtn}
                    onPress={() => navigation.navigate('AdminProfileDetail', { accountId: acc.id })}
                  >
                    <Text style={s.viewProfileBtnText}>View</Text>
                  </TouchableOpacity>
                )}
                {acc.role !== 'ADMIN' && (
                  <TouchableOpacity
                    style={[s.freezeBtn, acc.is_frozen ? s.unfreezeBtn : {}]}
                    onPress={() => {
                      Alert.alert(
                        acc.is_frozen ? 'Unfreeze Account' : 'Freeze Account',
                        `Are you sure you want to ${acc.is_frozen ? 'unfreeze' : 'freeze'} this account?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Confirm', onPress: () => handleToggleFreeze(acc.id), style: acc.is_frozen ? 'default' : 'destructive' }
                        ]
                      );
                    }}
                  >
                    <Text style={s.freezeBtnText}>{acc.is_frozen ? 'Unfreeze' : 'Freeze'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}

        {filteredAccounts.length === 0 && (
          <Text style={s.emptyText}>No accounts found.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const getRoleColor = (role: string, colors: any) => {
  const r = role?.toLowerCase();
  if (r === 'student') return colors.primary + '30';
  if (r === 'teacher' || r === 'tutor') return colors.accent + '30';
  if (r === 'parent') return colors.success + '30';
  return colors.surfaceHigh;
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing['3'], color: colors.textSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing['10'], paddingBottom: spacing['4'], paddingHorizontal: spacing['4'],
    backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderColor: colors.border
  },
  backBtn: { padding: spacing['2'] },
  backBtnText: { fontSize: 24, color: colors.text, fontWeight: 'bold' },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing['4'], paddingVertical: spacing['3'],
    gap: spacing['2'], backgroundColor: colors.background
  },
  filterChip: {
    paddingHorizontal: spacing['4'], paddingVertical: spacing['2'],
    borderRadius: radius.full, backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: colors.border
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  filterChipTextActive: { color: colors.background, fontWeight: typography.weight.bold },
  listContainer: { padding: spacing['4'], gap: spacing['4'] },
  accountCard: {
    backgroundColor: colors.surfaceElevated, padding: spacing['4'],
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder
  },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] },
  accountName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text },
  accountEmail: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  roleBadge: { paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.sm },
  roleBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.text },
  linkedStudents: {
    backgroundColor: colors.surfaceHigh, padding: spacing['3'], borderRadius: radius.md, marginBottom: spacing['3']
  },
  linkedTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.textSecondary, marginBottom: spacing['1'] },
  linkedStudentText: { fontSize: typography.size.sm, color: colors.text, marginBottom: 2 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['2'] },
  statusText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  statusActive: { color: colors.success },
  statusFrozen: { color: colors.danger },
  freezeBtn: {
    backgroundColor: '#FF3B30', paddingHorizontal: spacing['4'], paddingVertical: spacing['2'],
    borderRadius: radius.md
  },
  unfreezeBtn: { backgroundColor: colors.success },
  freezeBtnText: { color: '#fff', fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  viewProfileBtn: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + '50',
  },
  viewProfileBtnText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['10'] }
});
