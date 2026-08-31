import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

const getAttendanceColor = (pct: number, colors: any) => {
  if (pct >= 90) return colors.success;
  if (pct >= 50) return colors.warning;
  return colors.error;
};

const AttendanceCircle = ({ percentage }: { percentage: number }) => {
  const { colors } = useTheme();
  const color = getAttendanceColor(percentage, colors);
  const circleStyles = createCircleStyles(colors);
  return (
    <View style={[circleStyles.circle, { borderColor: color, shadowColor: color }]}>
      <Text style={[circleStyles.pctText, { color }]}>{percentage}%</Text>
      <Text style={circleStyles.label}>Attendance</Text>
    </View>
  );
};

const createCircleStyles = (colors: any) => StyleSheet.create({
  circle: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
  },
  pctText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.black },
  label: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
});

const ParentChildrenScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [childrenData, setChildrenData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    apiClient.get('parent/dashboard-stats/')
      .then(res => setChildrenData(res.data))
      .catch(err => console.error('Error fetching children', err))
      .finally(() => setLoading(false));
  }, []));

  const s = createStyles(colors);

  if (loading) {
    return (
      <View style={s.loadingWrapper}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={s.header}>
        <Text style={s.headerTitle}>My Children</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {childrenData.length > 0 ? (
          childrenData.map((child, idx) => {
            const attendanceRate = child.attendance_percentage || 0;
            const color = getAttendanceColor(attendanceRate, colors);

            return (
              <View key={idx} style={s.childCard}>
                <View style={s.cardHeader}>
                  <Text style={s.childName}>🧒 {child.username}</Text>
                </View>

                {/* Circle + Stats side by side */}
                <View style={s.mainRow}>
                  <AttendanceCircle percentage={attendanceRate} />
                  
                  <View style={s.statsCol}>
                    <View style={s.statRow}>
                      <View style={s.statBox}>
                        <Text style={s.statValue}>{child.total_sessions}</Text>
                        <Text style={s.statLabel}>Total Sessions</Text>
                      </View>
                      <View style={s.statBox}>
                        <Text style={[s.statValue, { color: colors.success }]}>{child.attended_sessions}</Text>
                        <Text style={s.statLabel}>Attended</Text>
                      </View>
                    </View>
                    <View style={s.statRow}>
                      <View style={s.statBox}>
                        <Text style={[s.statValue, { color: colors.primary }]}>{child.total_duration_minutes}m</Text>
                        <Text style={s.statLabel}>Total Time</Text>
                      </View>
                      <View style={s.statBox}>
                        <Text style={[s.statValue, { color: child.total_missed_minutes > 0 ? colors.error : colors.text }]}>
                          {child.total_missed_minutes}m
                        </Text>
                        <Text style={s.statLabel}>Missed</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Summary bar */}
                <View style={[s.summaryBar, { backgroundColor: color + '15', borderColor: color + '30' }]}>
                  <Text style={[s.summaryText, { color }]}>
                    {attendanceRate >= 90 ? '🟢 Excellent Attendance' : attendanceRate >= 50 ? '🟡 Needs Improvement' : '🔴 Low Attendance — Action Needed'}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No children linked yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    paddingTop: spacing['10'], paddingBottom: spacing['4'], paddingHorizontal: spacing['5'],
    backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  container: { padding: spacing['5'], paddingBottom: spacing['10'] },
  
  childCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.xl,
    padding: spacing['4'], marginBottom: spacing['4'],
    borderWidth: 1, borderColor: colors.glassBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  cardHeader: { marginBottom: spacing['4'], borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, paddingBottom: spacing['2'] },
  childName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['4'], marginBottom: spacing['4'] },
  statsCol: { flex: 1, gap: spacing['2'] },
  statRow: { flexDirection: 'row', gap: spacing['2'] },
  statBox: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing['2'], alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle,
  },
  statValue: { fontSize: typography.size.base, fontWeight: typography.weight.black, color: colors.text, marginBottom: 2 },
  statLabel: { fontSize: 9, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  summaryBar: { padding: spacing['3'], borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  summaryText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },

  emptyState: { alignItems: 'center', marginTop: spacing['10'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.base },
});

export default ParentChildrenScreen;
