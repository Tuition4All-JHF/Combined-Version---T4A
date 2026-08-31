import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';

const StudentAttendanceScreen = () => {
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'overall' | 'weekly' | 'monthly'>('overall');

  useEffect(() => {
    apiClient.get('student/attendance-stats/')
      .then(res => setData(res.data))
      .catch(err => console.error('Error fetching attendance stats:', err))
      .finally(() => setLoading(false));
  }, []);

  const s = createStyles(colors);

  if (loading) {
    return (
      <View style={s.loadingWrapper}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.loadingWrapper}>
        <Text style={s.emptyText}>Failed to load attendance data.</Text>
      </View>
    );
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return colors.success;
    if (percentage >= 50) return colors.warning;
    return colors.error;
  };

  const getStatusBadgeColor = (status: string) => {
    if (status === 'PRESENT') return colors.success;
    if (status === 'PARTIAL') return colors.warning;
    return colors.error;
  };

  const currentAvg = filter === 'overall'
    ? (data.overall_percentage ?? 0)
    : filter === 'weekly'
    ? (data.weekly_percentage ?? 0)
    : (data.monthly_percentage ?? 0);
  const circleColor = getStatusColor(currentAvg);

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={s.header}>
        <Text style={s.headerTitle}>Attendance Overview</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        
        {/* Toggle and Circle UI */}
        <View style={s.topSection}>
          <View style={s.filterRow}>
            <TouchableOpacity 
              style={[s.filterBtn, filter === 'overall' && s.filterBtnActive]}
              onPress={() => setFilter('overall')}
            >
              <Text style={[s.filterText, filter === 'overall' && s.filterTextActive]}>Overall</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.filterBtn, filter === 'weekly' && s.filterBtnActive]}
              onPress={() => setFilter('weekly')}
            >
              <Text style={[s.filterText, filter === 'weekly' && s.filterTextActive]}>Weekly</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.filterBtn, filter === 'monthly' && s.filterBtnActive]}
              onPress={() => setFilter('monthly')}
            >
              <Text style={[s.filterText, filter === 'monthly' && s.filterTextActive]}>Monthly</Text>
            </TouchableOpacity>
          </View>

          <View style={s.circleContainer}>
            <View style={[s.circle, { borderColor: circleColor, shadowColor: circleColor }]}>
              <Text style={[s.circleText, { color: circleColor }]}>
                {currentAvg}%
              </Text>
              <Text style={s.circleLabel}>{filter.toUpperCase()}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing['4'], width: '100%' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text }}>
                {data.total_sessions ?? 0}
              </Text>
              <Text style={{ fontSize: typography.size.xs, color: colors.textMuted }}>Total Sessions</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.success }}>
                {data.total_attended_minutes ?? 0}m
              </Text>
              <Text style={{ fontSize: typography.size.xs, color: colors.textMuted }}>Attended</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: (data.total_missed_minutes || 0) > 0 ? colors.error : colors.text }}>
                {data.total_missed_minutes ?? 0}m
              </Text>
              <Text style={{ fontSize: typography.size.xs, color: colors.textMuted }}>Missed</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Recent Sessions</Text>
        
        {data.recent_history && data.recent_history.length > 0 ? (
          <View style={s.tableContainer}>
            {/* Table Header */}
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 1 }]}>Session</Text>
              <Text style={[s.th, { textAlign: 'right' }]}>Status</Text>
            </View>

            {data.recent_history.map((item: any, idx: number) => {
              const bColor = getStatusBadgeColor(item.status);
              const isLast = idx === data.recent_history.length - 1;
              return (
                <View key={idx} style={[s.tableRow, isLast && s.tableRowLast]}>
                  {/* Session + status on same row */}
                  <View style={s.rowTop}>
                    <View style={s.sessionInfo}>
                      <Text style={s.subjectName} numberOfLines={1}>{item.subject}</Text>
                      <Text style={s.dateText}>{new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: bColor + '20', borderColor: bColor + '40' }]}>
                      <Text style={[s.statusText, { color: bColor }]} numberOfLines={1}>
                        {item.status === 'PRESENT' ? '✓ Present' : item.status === 'PARTIAL' ? '~ Partial' : '✗ Absent'}
                      </Text>
                    </View>
                  </View>
                  {/* Stats row */}
                  <View style={s.statsRow}>
                    <View style={s.statPill}>
                      <Text style={s.statPillLabel}>Duration</Text>
                      <Text style={s.statPillValue}>{item.total_duration_minutes || 0}m</Text>
                    </View>
                    <View style={s.statPill}>
                      <Text style={s.statPillLabel}>Attended</Text>
                      <Text style={[s.statPillValue, { color: colors.success }]}>{item.attended_minutes || 0}m</Text>
                    </View>
                    <View style={s.statPill}>
                      <Text style={s.statPillLabel}>Missed</Text>
                      <Text style={[s.statPillValue, { color: item.missed_minutes > 0 ? colors.error : colors.textMuted }]}>
                        {item.missed_minutes || 0}m
                      </Text>
                    </View>
                    <View style={s.statPill}>
                      <Text style={s.statPillLabel}>Score</Text>
                      <Text style={[s.statPillValue, { color: getStatusColor(item.percentage) }]}>{item.percentage}%</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No recent sessions found.</Text>
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
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },
  
  container: { padding: spacing['4'], paddingBottom: spacing['8'] },
  
  topSection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing['4'],
    marginBottom: spacing['6'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
  },
  
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing['6'],
    width: '80%',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: spacing['2'],
    alignItems: 'center',
    borderRadius: radius.full,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  filterTextActive: {
    color: colors.white,
  },

  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2'],
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  circleText: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.black,
  },
  circleLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing['3'],
  },
  
  tableContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing['3'],
    paddingHorizontal: spacing['4'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  th: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    paddingVertical: spacing['3'],
    paddingHorizontal: spacing['4'],
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['2'],
  },
  sessionInfo: {
    flex: 1,
    marginRight: spacing['2'],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing['2'],
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing['1'] + 2,
    paddingHorizontal: spacing['2'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statPillLabel: {
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statPillValue: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
    marginTop: 1,
  },
  td: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  subjectName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  dateText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing['3'],
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    letterSpacing: 0.3,
  },
  
  emptyState: {
    padding: spacing['6'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  }
});

export default StudentAttendanceScreen;
