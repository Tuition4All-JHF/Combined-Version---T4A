import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Image, Alert, Modal, TextInput, RefreshControl, BackHandler } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/authSlice';
import apiClient from '../../api/client';
import T4ALogo from '../../components/T4ALogo';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useTheme } from '../../theme/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';

const ParentDashboardScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { colors, isDark } = useTheme();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linking, setLinking] = useState(false);
  const [assignmentStats, setAssignmentStats] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchStats();
  }, []));

  const fetchStats = () => {
    setLoading(true);
    Promise.all([
      apiClient.get('parent/dashboard-stats/'),
      apiClient.get('parent/assignment-stats/')
    ])
      .then(([statsRes, assignRes]) => {
        setStats(statsRes.data);
        setAssignmentStats(assignRes.data);
      })
      .catch(err => console.error('Error fetching parent stats', err))
      .finally(() => setLoading(false));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      apiClient.get('parent/dashboard-stats/'),
      apiClient.get('parent/assignment-stats/')
    ]).then(([statsRes, assignRes]) => {
      setStats(statsRes.data);
      setAssignmentStats(assignRes.data);
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

  const handleLinkStudent = () => {
    setShowLinkModal(true);
    setLinkStudentId('');
  };

  const submitLinkRequest = () => {
    if (!linkStudentId.trim()) {
      Alert.alert('Error', 'Please enter a Student ID.');
      return;
    }
    
    setLinking(true);
    apiClient.post('auth/parent/link-student/', { student_uid: linkStudentId.trim() })
      .then(() => {
        Alert.alert('Success', 'Link request sent to student. It will appear here once they approve it.');
        setShowLinkModal(false);
        fetchStats();
      })
      .catch(err => {
        Alert.alert('Error', err.response?.data?.error || 'Failed to send link request.');
      })
      .finally(() => {
        setLinking(false);
      });
  };

  const menuItems = [
    { label: 'My Children', screen: 'ParentChildrenScreen', icon: '👦' },
    { label: 'AI Assistant', screen: 'AIChatScreen', icon: '🤖' },
    { label: 'Search & Book Tutors', screen: 'SearchTutors', icon: '🔍' },
    { label: 'Messages', screen: 'Messages', icon: '💬' },
    { label: 'Payment History', screen: 'ParentPaymentDashboard', icon: '💳' },
    { label: 'Profile Settings', screen: 'ParentProfileScreen', icon: '⚙️' },
  ];

  const s = createStyles(colors, isDark);

  return (
    <View style={s.container}>
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
          <Text style={s.greetingLabel}>Parent Portal 👪</Text>
          <Text style={s.greetingName}>Welcome, {user?.username}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Linked Children</Text>
          <TouchableOpacity onPress={handleLinkStudent}>
            <Text style={s.linkText}>+ Link Child</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ margin: spacing['5'] }} />
        ) : stats.length > 0 ? (
          stats.map((child, idx) => {
            const assignStat = assignmentStats.find(a => a.student_id === child.id);
            return (
              <View key={idx} style={s.childCard}>
                <Text style={s.childName}>🧒 {child.username}</Text>
                <View style={s.statsRow}>
                  <View style={s.statPill}>
                    <Text style={s.statValue}>{child.attended_sessions}/{child.total_sessions}</Text>
                    <Text style={s.statLabel}>Attended</Text>
                  </View>
                  <View style={s.statPill}>
                    <Text style={[s.statValue, { color: child.total_missed_minutes > 0 ? colors.error : colors.text }]}>
                      {child.total_missed_minutes}m
                    </Text>
                    <Text style={s.statLabel}>Missed Time</Text>
                  </View>
                </View>
                {assignStat && (
                  <View style={[s.statsRow, { marginTop: spacing['3'] }]}>
                    <View style={s.statPill}>
                      <Text style={[s.statValue, { color: colors.primary }]}>{assignStat.total}</Text>
                      <Text style={s.statLabel}>        Total Assignments</Text>
                    </View>
                    <View style={s.statPill}>
                      <Text style={[s.statValue, { color: colors.warning }]}>{assignStat.pending}</Text>
                      <Text style={s.statLabel}>Pending Tasks</Text>
                    </View>
                    <View style={s.statPill}>
                      <Text style={[s.statValue, { color: colors.success }]}>{assignStat.completed}</Text>
                      <Text style={s.statLabel}>Completed</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>You haven't linked any children yet.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={handleLinkStudent}>
              <Text style={s.primaryBtnText}>Link a Student</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[s.sectionTitle, { marginTop: spacing['6'], marginBottom: spacing['3'] }]}>
          Quick Links
        </Text>
        <View style={s.menuGrid}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={s.menuCard}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={s.menuIcon}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Link Student Modal */}
      <Modal visible={showLinkModal} transparent animationType="fade" onRequestClose={() => setShowLinkModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Link a Student</Text>
            <Text style={s.modalSub}>Enter the 6-digit Student ID (e.g. STU-123456)</Text>
            
            <TextInput
              style={s.modalInput}
              placeholder="STU-XXXXXX"
              placeholderTextColor={colors.textMuted}
              value={linkStudentId}
              onChangeText={setLinkStudentId}
              autoCapitalize="characters"
            />
            
            <View style={s.modalActions}>
              <TouchableOpacity 
                style={s.modalCancelBtn} 
                onPress={() => setShowLinkModal(false)}
                disabled={linking}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={s.modalSubmitBtn} 
                onPress={submitLinkRequest}
                disabled={linking}
              >
                {linking ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={s.modalSubmitText}>Book Slot</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing['5'],
    paddingBottom: spacing['6'],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
    borderBottomWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -30, right: -40,
    width: 250, height: 250, opacity: 0.05, resizeMode: 'contain',
  },
  headerGreeting: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    fontWeight: typography.weight.medium, marginBottom: 2,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing['10'], paddingBottom: spacing['4'],
  },
  logoutBtn: {
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1'],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  logoutText: { color: colors.textSecondary, fontSize: typography.size.sm },
  greetingLabel: { color: colors.textSecondary, fontSize: typography.size.sm, marginTop: spacing['2'] },
  greetingName: {
    color: colors.text, fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold, letterSpacing: typography.tracking.tight,
  },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['10'] },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'],
  },
  sectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text,
  },
  linkText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  
  childCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg, padding: spacing['4'], marginBottom: spacing['3'],
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  childName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['2'] },
  statsRow: { flexDirection: 'row', gap: spacing['3'] },
  statPill: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing['2'], alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle,
  },
  statValue: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },
  statLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase' },

  emptyCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing['6'],
    alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder, borderStyle: 'dashed',
  },
  emptyText: { color: colors.textMuted, fontSize: typography.size.sm, marginBottom: spacing['4'] },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['5'], paddingVertical: spacing['2'], borderRadius: radius.md },
  primaryBtnText: { color: colors.white, fontWeight: typography.weight.bold },

  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'] },
  menuCard: {
    width: '48%', backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder,
    marginBottom: spacing['3'],
  },
  menuIcon: { fontSize: 28, marginBottom: spacing['2'] },
  menuLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text, textAlign: 'center' },

  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: spacing['5']
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.xl,
    padding: spacing['6'], width: '100%', borderWidth: 1, borderColor: colors.border
  },
  modalTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['1'] },
  modalSub: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['4'] },
  modalInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing['3'], fontSize: typography.size.base, color: colors.text,
    backgroundColor: colors.surface, marginBottom: spacing['5']
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing['3'] },
  modalCancelBtn: { paddingVertical: spacing['2'], paddingHorizontal: spacing['4'], justifyContent: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: typography.weight.semibold },
  modalSubmitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing['2'], paddingHorizontal: spacing['4'],
    justifyContent: 'center', minWidth: 100, alignItems: 'center'
  },
  modalSubmitText: { color: colors.white, fontWeight: typography.weight.bold }
});

export default ParentDashboardScreen;
