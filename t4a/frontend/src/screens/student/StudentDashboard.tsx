import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Image, RefreshControl, BackHandler,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/authSlice';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeContext';
import T4ALogo from '../../components/T4ALogo';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from 'react-native';

const StudentDashboard = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { colors, isDark } = useTheme();
  const [stats, setStats] = useState({ upcoming: 0, completed: 0, tutors: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [linkRequests, setLinkRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    apiClient.get('bookings/')
      .then(res => {
        const bookings = res.data;
        const upcoming = bookings.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING').length;
        const completed = bookings.filter((b: any) => b.status === 'COMPLETED').length;
        const uniqueTutors = new Set(bookings.map((b: any) => b.tutor_name)).size;
        setStats({ upcoming, completed, tutors: uniqueTutors });
      })
      .catch(() => { })
      .finally(() => setLoadingStats(false));

    apiClient.get('auth/student/link-requests/')
      .then(res => setLinkRequests(res.data))
      .catch(err => console.error(err));
  }, []));

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      apiClient.get('bookings/').then(res => {
        const bookings = res.data;
        const upcoming = bookings.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING').length;
        const completed = bookings.filter((b: any) => b.status === 'COMPLETED').length;
        const uniqueTutors = new Set(bookings.map((b: any) => b.tutor_name)).size;
        setStats({ upcoming, completed, tutors: uniqueTutors });
      }).catch(() => { }),
      apiClient.get('auth/student/link-requests/').then(res => setLinkRequests(res.data)).catch(() => { })
    ]).finally(() => setRefreshing(false));
  }, []);

  const handleRequestAction = (id: number, action: 'approve' | 'reject') => {
    apiClient.post(`auth/student/link-requests/${id}/action/`, { action })
      .then(() => {
        setLinkRequests(prev => prev.filter(r => r.id !== id));
      })
      .catch(err => console.error(err));
  };

  const menuItems = [
    { label: 'Live Class', screen: 'StudentLiveClass', icon: '🎓', accent: colors.error, desc: 'Join active sessions' },
    { label: 'AI Assistant', screen: 'AIChatScreen', icon: '🤖', accent: colors.primary, desc: 'Ask AI questions' },
    { label: 'Attendance', screen: 'StudentAttendance', icon: '📊', accent: colors.warning, desc: 'View attendance stats' },
    { label: 'Search Tutors', screen: 'SearchTutors', icon: '🔍', accent: colors.primary, desc: 'Find your perfect match' },
    { label: 'My Bookings', screen: 'MyBookings', icon: '📅', accent: colors.success, desc: 'View your schedule' },
    { label: 'Assignments', screen: 'StudentAssignments', icon: '📝', accent: '#9c27b0', desc: 'View and submit tasks' },
    { label: 'Study Notes', screen: 'StudentStudyNotes', icon: '📚', accent: '#3f51b5', desc: 'Access your materials' },
    { label: 'Messages', screen: 'Messages', icon: '💬', accent: colors.info, desc: 'Chat with tutors' },
    { label: 'Settings', screen: 'StudentSettings', icon: '⚙️', accent: colors.textSecondary, desc: 'Account preferences' },
  ];

  const statItems = [
    { value: stats.upcoming, label: 'Upcoming', icon: '⏰', accent: colors.primary },
    { value: stats.completed, label: 'Completed', icon: '✅', accent: colors.success },
    { value: stats.tutors, label: 'My Tutors', icon: '👤', accent: colors.accent },
  ];

  const s = createStyles(colors, isDark);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: spacing['10'] }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <Image source={require('../../../assets/logo_transparent.png')} style={s.headerDecor} />
        <View style={s.headerTop}>
          <T4ALogo variant="full" theme={isDark ? 'dark' : 'colored'} scale={0.7} />
          <TouchableOpacity style={s.logoutBtn} onPress={() => dispatch(logout())}>
            <Text style={s.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
        <View style={s.headerGreeting}>
          <Text style={s.greetingLabel}>Hello 👋</Text>
          <Text style={s.greetingName}>{user?.username}</Text>
          <View style={{ flexDirection: 'row', gap: spacing['2'] }}>
            <View style={s.rolePill}>
              <Text style={s.rolePillText}>Student</Text>
            </View>
            <View style={[s.rolePill, { backgroundColor: colors.info + '20', borderColor: colors.info + '40' }]}>
              <Text style={[s.rolePillText, { color: colors.info, textTransform: 'none' }]}>
                ID: {user?.student_uid || 'STU-XXXXXX'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        {statItems.map((item) => (
          <View key={item.label} style={s.statCard}>
            <Text style={s.statIcon}>{item.icon}</Text>
            {loadingStats ? (
              <ActivityIndicator size="small" color={item.accent} />
            ) : (
              <Text style={[s.statNumber, { color: item.accent }]}>{item.value}</Text>
            )}
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Search CTA */}
      <TouchableOpacity
        style={s.searchBanner}
        onPress={() => navigation.navigate('SearchTutors')}
        activeOpacity={0.9}
      >
        <View>
          <Text style={s.searchBannerTitle}>Find a Tutor</Text>
          <Text style={s.searchBannerSub}>Browse by subject, rating & more →</Text>
        </View>
        <View style={s.searchBannerIcon}>
          <Text style={{ fontSize: 28 }}>🔍</Text>
        </View>
      </TouchableOpacity>

      {/* Link Requests */}
      {linkRequests.length > 0 && (
        <View style={s.requestsContainer}>
          <Text style={s.sectionTitle}>Parent Link Requests</Text>
          {linkRequests.map(req => (
            <View key={req.id} style={s.requestCard}>
              <Text style={s.requestText}>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>{req.parent_name}</Text> wants to link to your account.
              </Text>
              <View style={s.requestActions}>
                <TouchableOpacity style={s.approveBtn} onPress={() => handleRequestAction(req.id, 'approve')}>
                  <Text style={s.approveText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => handleRequestAction(req.id, 'reject')}>
                  <Text style={s.rejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <Text style={s.sectionTitle}>Quick Actions</Text>
      <View style={s.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={s.menuCard}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.8}
          >
            <View style={[s.menuIconCircle, { backgroundColor: item.accent + '20' }]}>
              <Text style={s.menuIcon}>{item.icon}</Text>
            </View>
            <View style={s.menuCardBody}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuDesc}>{item.desc}</Text>
            </View>
            <Text style={[s.menuArrow, { color: item.accent }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surfaceElevated,
    paddingBottom: spacing['6'],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
    overflow: 'hidden',
    marginBottom: spacing['4'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerDecor: {
    position: 'absolute', top: -30, right: -40,
    width: 250, height: 250, opacity: 0.05, resizeMode: 'contain',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['5'],
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
  },
  logoutBtn: {
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'] + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  headerGreeting: {
    paddingHorizontal: spacing['5'],
  },
  greetingLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  greetingName: {
    color: colors.text,
    fontSize: typography.size['4xl'],
    fontWeight: typography.weight.extrabold,
    letterSpacing: typography.tracking.tight,
    marginTop: spacing['1'],
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: 3,
    marginTop: spacing['2'],
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  rolePillText: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.widest,
    textTransform: 'uppercase',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing['5'],
    gap: spacing['3'],
    marginBottom: spacing['4'],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing['4'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statIcon: { fontSize: 18, marginBottom: spacing['1'] },
  statNumber: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.black,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginTop: spacing['1'],
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },

  // Search Banner
  searchBanner: {
    marginHorizontal: spacing['5'],
    marginBottom: spacing['5'],
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing['5'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  searchBannerTitle: {
    color: colors.white,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
  },
  searchBannerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.size.sm,
    marginTop: spacing['1'],
  },
  searchBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Menu
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    paddingHorizontal: spacing['5'],
    marginBottom: spacing['3'],
  },
  menuGrid: {
    paddingHorizontal: spacing['5'],
    gap: spacing['3'],
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing['3'],
  },
  menuIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: { fontSize: 22 },
  menuCardBody: { flex: 1 },
  menuLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  menuDesc: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
  },

  // Requests
  requestsContainer: {
    marginBottom: spacing['5'],
  },
  requestCard: {
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: spacing['5'],
    padding: spacing['4'],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    marginBottom: spacing['3'],
  },
  requestText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing['3'],
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing['3'],
  },
  approveBtn: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: spacing['2'],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  approveText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing['2'],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  rejectText: {
    color: colors.error,
    fontWeight: typography.weight.bold,
  },
});

export default StudentDashboard;
