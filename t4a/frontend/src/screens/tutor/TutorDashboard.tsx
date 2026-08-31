import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, StatusBar, RefreshControl, BackHandler,
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

const TutorDashboard = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { colors, isDark } = useTheme();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [todaysClasses, setTodaysClasses] = useState<any[]>([]);
  const [groupedClasses, setGroupedClasses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState<string>('APPROVED');

  useFocusEffect(useCallback(() => {
    apiClient.get('profile/me/')
      .then(res => {
        setProfilePhoto(res.data.profile_photo || null);
        if (res.data.verification_status) {
          setVerificationStatus(res.data.verification_status);
        }
      })
      .catch(() => { });

    apiClient.get('bookings/?date=today')
      .then(res => {
        const confirmed = res.data.filter((cls: any) => cls.status?.toLowerCase() === 'confirmed' && cls.start_time);
        setTodaysClasses(confirmed);
        const groups: { [key: string]: any } = {};
        confirmed.forEach((cls: any) => {
          const key = cls.start_time;
          if (!groups[key]) {
            groups[key] = {
              start_time: cls.start_time,
              bookingIds: [],
              students: [],
              subject: cls.subject_name,
              is_live: cls.is_live,
              time_slot: cls.time_slot,
              end_time: cls.end_time,
            };
          }
          groups[key].bookingIds.push(cls.id);
          groups[key].students.push(cls.student_name);
          if (cls.is_live) groups[key].is_live = true;
        });
        setGroupedClasses(Object.values(groups));
      })
      .catch(() => { });
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

  const handleMenuPress = (screen: string) => {
    if (screen === 'ManageAvailability' && verificationStatus !== 'APPROVED') {
      Alert.alert(
        'Admin Approval Pending ⏳',
        'Your profile is currently under review by our admin team. You cannot add class schedules until your account is approved by the admin.'
      );
      return;
    }
    navigation.navigate(screen);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      apiClient.get('profile/me/').then(res => setProfilePhoto(res.data.profile_photo || null)).catch(() => { }),
      apiClient.get('bookings/?date=today').then(res => {
        const confirmed = res.data.filter((cls: any) => cls.status === 'CONFIRMED' && cls.start_time);
        setTodaysClasses(confirmed);
        const groups: { [key: string]: any } = {};
        confirmed.forEach((cls: any) => {
          const key = cls.start_time;
          if (!groups[key]) { groups[key] = { start_time: cls.start_time, end_time: cls.end_time, bookingIds: [], students: [], subject: cls.subject_name, is_live: cls.is_live, time_slot: cls.time_slot }; }
          groups[key].bookingIds.push(cls.id);
          groups[key].students.push(cls.student_name);
          if (cls.is_live) groups[key].is_live = true;
        });
        setGroupedClasses(Object.values(groups));
      }).catch(() => { })
    ]).finally(() => setRefreshing(false));
  }, []);

  const menuItems = [
    { label: "Today's Classes", screen: 'TodaysClasses', icon: '🎓', desc: 'View schedule for today' },
    { label: 'AI Assistant', screen: 'AIChatScreen', icon: '🤖', desc: 'Ask AI about your classes' },
    { label: 'My Calendar', screen: 'TutorCalendarView', icon: '📅', desc: 'View your calendar schedules' },
    { label: 'Manage Availability', screen: 'ManageAvailability', icon: '🗓', desc: 'Schedule group classes' },
    { label: 'My Bookings', screen: 'BookingRequests', icon: '📋', desc: 'View confirmed bookings' },
    { label: 'My Students', screen: 'MyStudents', icon: '👥', desc: 'Manage your learners' },
    { label: 'Assignments', screen: 'TutorAssignments', icon: '📝', desc: 'Manage assignments' },
    { label: 'Study Notes', screen: 'TutorStudyNotes', icon: '📚', desc: 'Upload notes for students' },
    { label: 'Messages', screen: 'Messages', icon: '💬', desc: 'Chat with students' },
    { label: 'Reviews', screen: 'Reviews', icon: '⭐', desc: 'See student feedback' },
    { label: 'Profile', screen: 'TutorProfile', icon: '👤', desc: 'Edit your public profile' },
    { label: 'Settings', screen: 'Settings', icon: '⚙️', desc: 'Account preferences' },
  ];

  const initials = user?.username?.[0]?.toUpperCase() || '?';

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
        <View style={s.headerMain}>
          <View style={s.avatarRing}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={s.avatarImage} />
            ) : (
              <Text style={s.avatarText}>{initials}</Text>
            )}
          </View>
          <View>
            <Text style={s.greetingLabel}>Tutor Dashboard 🎓</Text>
            <Text style={s.greetingName}>{user?.username}</Text>
            <View style={s.rolePill}>
              <Text style={s.rolePillText}>Tutor</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statIcon}>📋</Text>
          <Text style={[s.statNumber, { color: colors.warning }]}>0</Text>
          <Text style={s.statLabel}>Pending</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statIcon}>📅</Text>
          <Text style={[s.statNumber, { color: colors.primary }]}>
            {groupedClasses.length}
          </Text>
          <Text style={s.statLabel}>Today</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statIcon}>⭐</Text>
          <Text style={[s.statNumber, { color: colors.warning }]}>0.0</Text>
          <Text style={s.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Today's Classes */}
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionTitle}>Today's Classes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TodaysClasses')}>
          <Text style={s.viewAllText}>View All →</Text>
        </TouchableOpacity>
      </View>

      {groupedClasses.length > 0 ? groupedClasses.map((grp, idx) => {
        const firstBookingId = grp.bookingIds[0];
        const roomId = grp.time_slot?.room_name;
        const timeStr = new Date(grp.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <View key={idx} style={s.classCard}>
            <View style={[s.classAccent, { backgroundColor: grp.is_live ? colors.error : colors.primary }]} />
            <View style={{ flex: 1 }}>
              <View style={s.classCardTop}>
                <Text style={s.classTitle}>
                  {grp.students.length > 1 ? `Group (${grp.students.length})` : grp.students[0]}
                </Text>
                {grp.is_live && (
                  <View style={s.liveBadge}>
                    <View style={s.liveDot} />
                    <Text style={s.liveText}>LIVE</Text>
                  </View>
                )}
              </View>
              {grp.students.length > 1 && (
                <Text style={s.classStudents}>{grp.students.join(', ')}</Text>
              )}
              <Text style={s.classSubtitle}>{grp.subject} · {timeStr}</Text>
            </View>
            <TouchableOpacity
              style={s.startBtn}
              onPress={() => navigation.navigate('LiveSessionScreen', {
                roomId,
                isTutor: true,
                bookingIds: grp.bookingIds,
                  timeSlotId: grp.time_slot?.id,
                end_time: grp.end_time,
              })}
              activeOpacity={0.85}
            >
              <Text style={s.startBtnText}>Start</Text>
            </TouchableOpacity>
          </View>
        );
      }) : (
        <View style={s.noClassesBox}>
          <Text style={s.noClassesText}>No confirmed classes for today.</Text>
        </View>
      )}

      {/* Menu */}
      <Text style={[s.sectionTitle, { paddingHorizontal: spacing['5'], marginTop: spacing['5'] }]}>
        Manage
      </Text>
      <View style={s.menuList}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={s.menuCard}
            onPress={() => handleMenuPress(item.screen)}
            activeOpacity={0.8}
          >
            <View style={s.menuIconCircle}>
              <Text style={s.menuIcon}>{item.icon}</Text>
            </View>
            <View style={s.menuBody}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuDesc}>{item.desc}</Text>
            </View>
            <Text style={s.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing['5'], paddingTop: spacing['10'], paddingBottom: spacing['4'],
  },
  logoutBtn: {
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1'] + 2,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  logoutText: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  headerMain: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing['5'], gap: spacing['3'],
  },
  avatarRing: {
    width: 60, height: 60, borderRadius: radius.full,
    borderWidth: 2.5, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 6,
    overflow: 'hidden',
  },
  avatarImage: { width: 60, height: 60 },
  avatarText: { color: colors.primary, fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold },
  greetingLabel: { color: colors.textSecondary, fontSize: typography.size.sm },
  greetingName: {
    color: colors.text, fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold, letterSpacing: typography.tracking.tight,
  },
  rolePill: {
    alignSelf: 'flex-start', backgroundColor: colors.accent + '20',
    borderRadius: radius.full, paddingHorizontal: spacing['3'], paddingVertical: 3,
    marginTop: spacing['1'], borderWidth: 1, borderColor: colors.accent + '40',
  },
  rolePillText: {
    color: colors.accent, fontSize: typography.size.xs,
    fontWeight: typography.weight.bold, letterSpacing: typography.tracking.widest, textTransform: 'uppercase',
  },

  statsRow: {
    flexDirection: 'row', paddingHorizontal: spacing['5'], gap: spacing['3'], marginBottom: spacing['4'],
  },
  statCard: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder,
  },
  statIcon: { fontSize: 18, marginBottom: spacing['1'] },
  statNumber: { fontSize: typography.size['3xl'], fontWeight: typography.weight.black },
  statLabel: {
    color: colors.textMuted, fontSize: typography.size.xs, marginTop: spacing['1'],
    fontWeight: typography.weight.medium, textAlign: 'center',
  },

  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing['5'], marginBottom: spacing['3'],
  },
  sectionTitle: {
    fontSize: typography.size.md, fontWeight: typography.weight.bold,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },
  viewAllText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },

  classCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, marginHorizontal: spacing['5'],
    marginBottom: spacing['3'], borderRadius: radius.lg,
    padding: spacing['4'], borderWidth: 1, borderColor: colors.glassBorder,
    gap: spacing['3'],
  },
  classAccent: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0, bottom: 0 },
  classCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
  classTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text },
  classStudents: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  classSubtitle: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 3 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.errorBg, borderRadius: radius.full,
    paddingHorizontal: spacing['2'], paddingVertical: 2, borderWidth: 1, borderColor: colors.error + '40',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error },
  liveText: { color: colors.error, fontSize: 9, fontWeight: typography.weight.extrabold, letterSpacing: 1 },
  startBtn: {
    backgroundColor: colors.primary, paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'], borderRadius: radius.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  startBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  noClassesBox: {
    marginHorizontal: spacing['5'], backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg, padding: spacing['5'], alignItems: 'center',
    borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing['3'],
  },
  noClassesText: { color: colors.textMuted, fontSize: typography.size.sm, fontStyle: 'italic' },

  menuList: { paddingHorizontal: spacing['5'], gap: spacing['3'] },
  menuCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], borderWidth: 1, borderColor: colors.glassBorder, gap: spacing['3'],
  },
  menuIconCircle: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  menuIcon: { fontSize: 22 },
  menuBody: { flex: 1 },
  menuLabel: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text },
  menuDesc: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  menuArrow: { fontSize: 24, color: colors.textSecondary, fontWeight: typography.weight.bold },
});

export default TutorDashboard;
