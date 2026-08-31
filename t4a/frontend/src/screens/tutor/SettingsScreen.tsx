import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, StatusBar,
} from 'react-native';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/authSlice';
import { useTheme } from '../../theme/ThemeContext';

const SettingsScreen = () => {
  const dispatch = useDispatch();
  const { colors, isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [altEmail, setAltEmail] = useState('');
  const [showFaq, setShowFaq] = useState(false);

  const handlePasswordSave = () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    Alert.alert('Success', 'Password changed successfully');
    setShowPassword(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleEmailSave = () => {
    Alert.alert('Success', 'Alternative email saved');
    setShowEmail(false);
  };

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
        <Text style={s.headerTitle}>Settings</Text>
        <Text style={s.headerSub}>Account preferences & support</Text>
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

      {/* Notifications */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Notifications</Text>
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>🔔</Text>
            <Text style={s.rowLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: colors.surface, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Account */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Account</Text>

        <TouchableOpacity style={s.row} onPress={() => setShowPassword(!showPassword)}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>🔒</Text>
            <Text style={s.rowLabel}>Change Password</Text>
          </View>
          <Text style={s.arrow}>{showPassword ? '↑' : '›'}</Text>
        </TouchableOpacity>
        {showPassword && (
          <View style={s.expandable}>
            <TextInput
              style={s.input}
              placeholder="New Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={s.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={s.saveBtn} onPress={handlePasswordSave} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Save Password</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[s.row, { borderBottomWidth: showEmail ? 0 : 1 }]}
          onPress={() => setShowEmail(!showEmail)}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>📧</Text>
            <Text style={s.rowLabel}>Email Preferences</Text>
          </View>
          <Text style={s.arrow}>{showEmail ? '↑' : '›'}</Text>
        </TouchableOpacity>
        {showEmail && (
          <View style={[s.expandable, { borderBottomWidth: 0 }]}>
            <Text style={s.subtext}>Alternative email for account recovery</Text>
            <TextInput
              style={s.input}
              placeholder="Alternative Email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={altEmail}
              onChangeText={setAltEmail}
            />
            <TouchableOpacity style={s.saveBtn} onPress={handleEmailSave} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Save Email</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Support */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>Support</Text>

        <TouchableOpacity style={s.row} onPress={() => Alert.alert('Contact', 'support@tuition4all.com')}>
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>💬</Text>
            <Text style={s.rowLabel}>Contact Support</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.row, { borderBottomWidth: 0 }]}
          onPress={() => setShowFaq(!showFaq)}
        >
          <View style={s.rowLeft}>
            <Text style={s.rowIcon}>❓</Text>
            <Text style={s.rowLabel}>FAQ</Text>
          </View>
          <Text style={s.arrow}>{showFaq ? '↑' : '›'}</Text>
        </TouchableOpacity>
        {showFaq && (
          <View style={s.faqBox}>
            <Text style={s.faqQ}>Q: How do I schedule a meeting?</Text>
            <Text style={s.faqA}>
              A: Go to Manage Availability and select a specific date and time for your live class.
            </Text>
            <Text style={s.faqQ}>Q: How do I get paid?</Text>
            <Text style={s.faqA}>
              A: Payments are processed weekly directly to your linked bank account.
            </Text>
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={s.logoutBtn}
        onPress={() => dispatch(logout())}
        activeOpacity={0.85}
      >
        <Text style={s.logoutIcon}>↪</Text>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={s.version}>Tuition4All v1.0 · Learning for everyone, anywhere.</Text>
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
  themeBtnLabelActive: {
    color: colors.primary,
  },

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

  expandable: {
    paddingVertical: spacing['3'],
    paddingBottom: spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing['3'],
    marginBottom: spacing['2'],
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: typography.size.sm,
  },
  subtext: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: spacing['2'],
  },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: spacing['3'],
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing['2'],
  },
  saveBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },

  faqBox: {
    paddingVertical: spacing['3'],
    paddingBottom: spacing['4'],
    gap: spacing['1'],
  },
  faqQ: {
    fontWeight: typography.weight.bold,
    color: colors.text,
    fontSize: typography.size.sm,
    marginTop: spacing['3'],
  },
  faqA: {
    color: colors.textSecondary,
    marginTop: spacing['1'],
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.relaxed,
  },

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

export default SettingsScreen;
