import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';

const TodaysClasses = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('bookings/?date=today')
      .then(res => setClasses(res.data))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, []);

  const s = createStyles(colors);

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Today's Classes</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
        ) : classes.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🎉</Text>
            <Text style={s.emptyTitle}>No classes today</Text>
            <Text style={s.emptyText}>Your upcoming classes will appear here.</Text>
          </View>
        ) : (
          classes.map((cls: any) => (
            <View key={cls.id} style={s.card}>
              <View style={[s.cardAccent, {
                backgroundColor: cls.status === 'CONFIRMED' ? colors.success : colors.textMuted
              }]} />
              <View style={s.cardBody}>
                <View style={s.cardTop}>
                  <Text style={s.cardTitle}>{cls.student_name}</Text>
                  {cls.is_live && (
                    <View style={s.liveBadge}>
                      <View style={s.liveDot} />
                      <Text style={s.liveText}>LIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardSubtitle}>{cls.subject_name} · {cls.time || 'TBD'}</Text>
                <View style={[s.statusBadge, {
                  backgroundColor: cls.status?.toLowerCase() === 'confirmed' ? colors.successBg : colors.surface
                }]}>
                  <Text style={[s.statusText, {
                    color: cls.status?.toLowerCase() === 'confirmed' ? colors.success : colors.textSecondary
                  }]}>
                    {cls.status?.toUpperCase()}
                  </Text>
                </View>
              </View>
              {cls.status?.toLowerCase() === 'confirmed' && (
                <TouchableOpacity
                  style={s.startBtn}
                  onPress={() => navigation.navigate('LiveSessionScreen', {
                    roomId: cls.time_slot?.room_name, 
                    isTutor: true, 
                    bookingIds: [cls.id],
                    end_time: cls.end_time,
                  })}
                  activeOpacity={0.85}
                >
                  <Text style={s.startBtnText}>Start</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'], paddingBottom: spacing['4'], paddingHorizontal: spacing['5'],
    borderBottomWidth: 1, borderColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: typography.weight.bold },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  container: { padding: spacing['4'], paddingBottom: spacing['8'] },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['2'], textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    marginBottom: spacing['3'], borderWidth: 1, borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  cardAccent: { width: 4, height: '100%' },
  cardBody: { flex: 1, padding: spacing['4'] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] },
  cardTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text },
  cardSubtitle: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['2'] },
  statusBadge: {
    alignSelf: 'flex-start', borderRadius: radius.full,
    paddingHorizontal: spacing['3'], paddingVertical: 2,
  },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.errorBg, borderRadius: radius.full,
    paddingHorizontal: spacing['2'], paddingVertical: 2,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.error },
  liveText: { color: colors.error, fontSize: 8, fontWeight: typography.weight.extrabold, letterSpacing: 1 },
  startBtn: {
    backgroundColor: colors.primary, margin: spacing['3'],
    paddingHorizontal: spacing['4'], paddingVertical: spacing['3'],
    borderRadius: radius.md,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  startBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
});

export default TodaysClasses;
