
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, StatusBar, RefreshControl, BackHandler, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { adminApi } from '../../api/adminApi';
import { logout } from '../../redux/authSlice';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import T4ALogo from '../../components/T4ALogo';
import { useTheme } from '../../theme/ThemeContext';

export default function AdminDashboard() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { colors, isDark, toggleTheme } = useTheme();
  const [stats, setStats] = useState({ total_students: 0, total_tutors: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    adminApi.getDashboardStats().then((data) => {
      setStats(data);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    adminApi.getDashboardStats().then((data) => {
      setStats(data);
    }).catch(() => {}).finally(() => setRefreshing(false));
  }, []);

  // Back button exit confirmation
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Exit App', 'Are you sure you want to close the app?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, []));

  const statCards = [
    { value: stats.total_students, label: 'Total Students', icon: '🎓', accent: colors.primary },
    { value: stats.total_tutors, label: 'Total Tutors', icon: '📚', accent: colors.accent },
  ];

  const actions = [
    { label: 'Tutor Verification', desc: 'Review and approve tutor applications', icon: '✅', screen: 'AdminTutorVerification', accent: colors.success },
    { label: 'Manage Subjects', desc: 'Add or remove subjects', icon: '📖', screen: 'AdminSubjects', accent: colors.primary },
    { label: 'Payment Logs', desc: 'View transaction history', icon: '💳', screen: 'AdminPayments', accent: colors.warning },
    { label: 'Accounts', desc: 'Manage user accounts and freezing', icon: '👥', screen: 'AdminAccounts', accent: colors.danger || '#e74c3c' },
  ];

  const s = createStyles(colors);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={s.header}>
        <View style={s.headerDecor} />
        <T4ALogo variant="full" theme={isDark ? 'dark' : 'colored'} scale={0.7} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['2'] }}>
          <TouchableOpacity style={s.themeToggleBtn} onPress={toggleTheme}>
            <Text style={s.themeToggleIcon}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.logoutBtnSmall} onPress={() => dispatch(logout())}>
            <Text style={s.logoutBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing['5'], marginTop: spacing['5'] }}>
        <View style={s.adminPill}>
          <Text style={s.adminPillText}>⚡ Admin Portal</Text>
        </View>
        <Text style={s.headerTitle}>Dashboard</Text>
      </View>

      <View style={s.statsRow}>
        {statCards.map(card => (
          <View key={card.label} style={s.statCard}>
            <Text style={s.statIcon}>{card.icon}</Text>
            <Text style={[s.statValue, { color: card.accent }]}>{card.value}</Text>
            <Text style={s.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>Admin Actions</Text>
      <View style={s.actionsGrid}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.screen}
            style={[s.actionCard, { borderLeftColor: action.accent }]}
            onPress={() => navigation.navigate(action.screen)}
            activeOpacity={0.8}
          >
            <View style={[s.actionIconCircle, { backgroundColor: action.accent + '20' }]}>
              <Text style={s.actionIcon}>{action.icon}</Text>
            </View>
            <View style={s.actionBody}>
              <Text style={s.actionLabel}>{action.label}</Text>
              <Text style={s.actionDesc}>{action.desc}</Text>
            </View>
            <Text style={[s.actionArrow, { color: action.accent }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: spacing['3'] },
  loadingText: { color: colors.textSecondary, fontSize: typography.size.sm },
  header: {
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing['10'], paddingBottom: spacing['6'], paddingHorizontal: spacing['5'],
    borderBottomWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -40, right: -20,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: colors.primary, opacity: 0.1,
  },
  themeToggleBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  themeToggleIcon: { fontSize: 16 },
  logoutBtnSmall: {
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1'] + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  logoutBtnText: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  adminPill: {
    alignSelf: 'flex-start', backgroundColor: colors.warning + '15',
    borderRadius: radius.full, paddingHorizontal: spacing['3'], paddingVertical: 3,
    marginBottom: spacing['2'], borderWidth: 1, borderColor: colors.warning + '40',
  },
  adminPillText: {
    color: colors.warning, fontSize: typography.size.xs,
    fontWeight: typography.weight.bold, letterSpacing: typography.tracking.widest,
  },
  headerTitle: {
    fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold,
    color: colors.text, letterSpacing: typography.tracking.tight,
  },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: spacing['5'],
    gap: spacing['3'], marginBottom: spacing['5'],
  },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: radius.xl,
    padding: spacing['5'], alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  statIcon: { fontSize: 28, marginBottom: spacing['2'] },
  statValue: {
    fontSize: typography.size['4xl'], fontWeight: typography.weight.black,
    letterSpacing: typography.tracking.tight,
  },
  statLabel: {
    color: colors.textMuted, fontSize: typography.size.xs,
    marginTop: spacing['1'], fontWeight: typography.weight.medium, textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.size.md, fontWeight: typography.weight.bold,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    paddingHorizontal: spacing['5'], marginBottom: spacing['3'],
  },
  actionsGrid: { paddingHorizontal: spacing['5'], gap: spacing['3'] },
  actionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], borderWidth: 1, borderLeftWidth: 4,
    borderColor: colors.glassBorder, gap: spacing['3'],
  },
  actionIconCircle: {
    width: 48, height: 48, borderRadius: radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  actionIcon: { fontSize: 24 },
  actionBody: { flex: 1 },
  actionLabel: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text },
  actionDesc: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  actionArrow: { fontSize: 24, fontWeight: typography.weight.bold },
});
