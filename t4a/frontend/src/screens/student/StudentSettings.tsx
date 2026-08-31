import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/authSlice';
import { useTheme } from '../../theme/ThemeContext';

const StudentSettings = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const { colors, isDark, toggleTheme } = useTheme();

  const settingsItems = [
    {
      label: 'Account',
      items: [
        { icon: '🔒', label: 'Change Password', onPress: () => Alert.alert('Coming Soon', 'Change password will be available soon.') },
        { icon: '🔔', label: 'Notifications', onPress: () => Alert.alert('Coming Soon', 'Notification settings coming soon.') },
      ],
    },
    {
      label: 'Support',
      items: [
        { icon: '💬', label: 'Contact Support', onPress: () => Alert.alert('Contact', 'support@tuition4all.com') },
        { icon: '📖', label: 'About Tuition4All', onPress: () => Alert.alert('T4A', 'Learning for everyone, anywhere.\nVersion 1.0') },
      ],
    },
  ];

  const s = createStyles(colors);

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={s.headerBanner}>
        <View style={s.headerDecor} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <Text style={s.headerSub}>Account & preferences</Text>
      </View>

      {/* Appearance */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Appearance</Text>
        <View style={s.themeRow}>
          <TouchableOpacity
            style={[s.themeBtn, !isDark && s.themeBtnActive]}
            onPress={() => isDark && toggleTheme()}
            activeOpacity={0.8}
          >
            <Text style={s.themeBtnIcon}>☀️</Text>
            <Text style={[s.themeBtnLabel, !isDark && s.themeBtnLabelActive]}>Light Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.themeBtn, isDark && s.themeBtnActive]}
            onPress={() => !isDark && toggleTheme()}
            activeOpacity={0.8}
          >
            <Text style={s.themeBtnIcon}>🌙</Text>
            <Text style={[s.themeBtnLabel, isDark && s.themeBtnLabelActive]}>Dark Mode</Text>
          </TouchableOpacity>
        </View>
      </View>

      {settingsItems.map(section => (
        <View key={section.label} style={s.section}>
          <Text style={s.sectionLabel}>{section.label}</Text>
          {section.items.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[
                s.row,
                idx === section.items.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={item.onPress}
              activeOpacity={0.75}
            >
              <View style={s.rowLeft}>
                <Text style={s.rowIcon}>{item.icon}</Text>
                <Text style={s.rowLabel}>{item.label}</Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity style={s.logoutBtn} onPress={() => dispatch(logout())} activeOpacity={0.85}>
        <Text style={s.logoutIcon}>↪</Text>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={s.version}>Tuition4All · Learning for everyone, anywhere.</Text>
    </ScrollView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  headerBanner: {
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['6'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['4'],
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.primary, opacity: 0.08,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing['3'],
  },
  backText: { color: colors.text, fontSize: 18, fontWeight: typography.weight.bold },
  headerTitle: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  headerSub: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing['1'],
  },

  section: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    marginHorizontal: spacing['5'],
    marginBottom: spacing['3'],
    paddingHorizontal: spacing['4'],
    paddingTop: spacing['3'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    marginBottom: spacing['2'],
    paddingBottom: spacing['2'],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },

  themeRow: {
    flexDirection: 'row',
    gap: spacing['3'],
    paddingVertical: spacing['3'],
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    paddingVertical: spacing['3'],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  themeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  themeBtnIcon: { fontSize: 16 },
  themeBtnLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  themeBtnLabelActive: { color: colors.primary },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing['3'] },
  rowIcon: { fontSize: 18 },
  rowLabel: { fontSize: typography.size.base, color: colors.text, fontWeight: typography.weight.medium },
  arrow: { fontSize: 18, color: colors.textSecondary, fontWeight: typography.weight.bold },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error + '40',
    marginHorizontal: spacing['5'],
    padding: spacing['4'],
    borderRadius: radius.lg,
    marginTop: spacing['4'],
    marginBottom: spacing['3'],
  },
  logoutIcon: { fontSize: 18, color: colors.error },
  logoutText: { color: colors.error, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.size.xs,
    marginBottom: spacing['8'],
    letterSpacing: typography.tracking.wide,
  },
});

export default StudentSettings;
