import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';

const getAvatarPalette = (colors: any) => [
  colors.primary,
  '#FF6584',
  '#43C6AC',
  '#F7971E',
  '#11998E',
  colors.accent,
];

const getAttendanceColor = (pct: number, colors: any) => {
  if (pct >= 95) return colors.success;
  if (pct >= 50) return colors.warning;
  return colors.error;
};

const MiniCircle = ({ pct, colors }: { pct: number; colors: any }) => {
  const color = getAttendanceColor(pct, colors);
  const s = createStyles(colors);

  const circleStyle = createCircleStyle(colors);
  return (
    <View style={[circleStyle.wrap, { borderColor: color }]}>
      <Text style={[circleStyle.text, { color }]}>{pct}%</Text>
      <Text style={circleStyle.lbl}>Att.</Text>
    </View>
  );
};

const createCircleStyle = (colors: any) => StyleSheet.create({
  wrap: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  text: { fontSize: typography.size.sm, fontWeight: typography.weight.black },
  lbl: { fontSize: 7, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const MyStudents = ({ navigation }: any) => {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('my-students/')
      .then(res => setStudents(res.data))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

  const getInitials = (name: string) =>
    name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const startChat = (student: any) => {
    apiClient.post('chat/rooms/', { other_user_id: student.id })
      .then(res => {
        navigation.navigate('ChatScreen', { room: res.data, otherName: student.username });
      })
      .catch(err => console.error('Error starting chat:', err));
  };

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>My Students</Text>
        {!loading && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{students.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
        ) : students.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🧑‍🎓</Text>
            <Text style={s.emptyTitle}>No students yet</Text>
            <Text style={s.emptyText}>
              Students who book your sessions will appear here.
            </Text>
          </View>
        ) : (
          students.map((stu: any, i: number) => {
            const avatarColor = getAvatarPalette(colors)[i % getAvatarPalette(colors).length];
            return (
              <View key={stu.id} style={s.card}>
                <View style={[s.avatar, { backgroundColor: avatarColor + '25', borderColor: avatarColor + '60' }]}>
                  <Text style={[s.avatarText, { color: avatarColor }]}>
                    {getInitials(stu.username)}
                  </Text>
                </View>
                <View style={s.info}>
                  <Text style={s.name}>{stu.username}</Text>
                  <Text style={s.meta}>
                    {stu.sessions_count || 0} session{(stu.sessions_count || 0) !== 1 ? 's' : ''}
                  </Text>
                  {stu.total_missed_duration_minutes !== undefined && stu.total_missed_duration_minutes > 0 && (
                    <Text style={[s.meta, { color: colors.warning }]}>
                      Missed: {stu.total_missed_duration_minutes} mins
                    </Text>
                  )}
                </View>
                {stu.overall_attendance_percentage !== undefined && (
                  <MiniCircle pct={Math.round(stu.overall_attendance_percentage)} colors={colors} />
                )}
                <TouchableOpacity 
                  style={s.chatBtn}
                  onPress={() => startChat(stu)}
                >
                  <Text style={s.chatBtnText}>💬 Chat</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.primary + '20',
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderWidth: 1,
    borderColor: colors.primary + '40',
    minWidth: 36,
    alignItems: 'center',
  },
  countText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },

  container: { padding: spacing['4'], paddingBottom: spacing['8'] },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginTop: spacing['2'], textAlign: 'center',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing['4'],
    marginBottom: spacing['3'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing['3'],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarText: {
    fontWeight: typography.weight.extrabold,
    fontSize: typography.size.lg,
  },
  info: { flex: 1 },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  meta: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 3,
  },
  sessionsPill: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  sessionsNum: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.extrabold,
  },
  chatBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    borderRadius: radius.md,
  },
  chatBtnText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});

export default MyStudents;
