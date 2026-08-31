import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

const StudentLiveClass = ({ navigation }: any) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTime, setNowTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = (isRefreshing = false) => {
    if (!isRefreshing && classes.length === 0) setLoading(true);
    apiClient.get('bookings/?date=today&status=CONFIRMED')
      .then(res => setClasses(res.data))
      .catch(() => setClasses([]))
      .finally(() => {
        setLoading(false);
        if (isRefreshing) setRefreshing(false);
      });
  };

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchClasses(true);
  };

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Live Classes</Text>
          <Text style={styles.headerSub}>Today's scheduled sessions</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
        ) : classes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🗓</Text>
            <Text style={styles.emptyTitle}>No sessions today</Text>
            <Text style={styles.emptyText}>
              Your tutor hasn't scheduled any classes for today.{'\n'}Pull down to refresh.
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {classes.map((cls: any) => {
              const now = nowTime;
              const startTime = cls.start_time ? new Date(cls.start_time) : null;
              const timeDiffMs = startTime ? startTime.getTime() - now.getTime() : 0;
              const isTooEarly = timeDiffMs > 120000;
              const minsLeft = Math.ceil(timeDiffMs / 60000);
              const endTime = cls.end_time ? new Date(cls.end_time) : null;
              const isEnded = endTime && now > endTime;
              const isLive = cls.is_live && !isEnded;
              
              const timeStr = cls.start_time
                ? new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'TBD';

              const handleJoin = () => {
                const isGroup = cls.time_slot?.session_type === 'ONE_TO_MANY';
                const roomId = cls.time_slot?.room_name;
                navigation.navigate('LiveSessionScreen', {
                  roomId,
                  isTutor: false,
                  bookingIds: [cls.id],
                    timeSlotId: cls.time_slot?.id,
                  end_time: cls.end_time,
                });
              };

              return (
                <View key={cls.id} style={[styles.card, isLive && styles.cardLive]}>
                  {/* Live pulse indicator */}
                  {isLive && (
                    <View style={styles.liveStrip}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveStripText}>LIVE NOW</Text>
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <View style={styles.cardLeft}>
                      <View style={[styles.tutorAvatar, isLive && styles.tutorAvatarLive]}>
                        <Text style={styles.tutorAvatarText}>
                          {cls.tutor_name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tutorName}>{cls.tutor_name}</Text>
                        <Text style={styles.subjectText}>{cls.subject_name}</Text>
                        <View style={styles.timeRow}>
                          <Text style={styles.timeIcon}>⏰</Text>
                          <Text style={styles.timeText}>{timeStr}</Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.joinBtn,
                        
                        (isEnded || isTooEarly) && { backgroundColor: colors.border }
                      ]}
                      onPress={handleJoin}
                      disabled={isEnded || isTooEarly}
                      activeOpacity={(isEnded || isTooEarly) ? 1 : 0.85}
                    >
                      <Text style={[
                        styles.joinBtnText,
                        
                        (isEnded || isTooEarly) && { color: colors.textSecondary }
                      ]}>
                        {isEnded ? 'Class Ended' : isTooEarly ? `Starts in ${minsLeft}m` : 'Join Class'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing['8'] }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: typography.weight.bold },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },
  headerSub: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  container: { flex: 1 },

  emptyBox: {
    alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['8'],
  },
  emptyIcon: { fontSize: 64, marginBottom: spacing['3'] },
  emptyTitle: {
    fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold,
    color: colors.text, textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginTop: spacing['2'], textAlign: 'center', lineHeight: typography.lineHeight.relaxed,
  },

  cardList: { padding: spacing['4'], gap: spacing['3'] },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  cardLive: {
    borderColor: colors.error + '50',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },

  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
    backgroundColor: colors.errorBg,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    borderBottomWidth: 1,
    borderColor: colors.error + '30',
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.error,
  },
  liveStripText: {
    color: colors.error, fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold, letterSpacing: 1.5,
  },

  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing['4'],
    gap: spacing['3'],
  },
  cardLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing['3'],
  },

  tutorAvatar: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.primary + '50',
  },
  tutorAvatarLive: {
    borderColor: colors.error + '80',
    backgroundColor: colors.error + '15',
  },
  tutorAvatarText: {
    color: colors.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
  },

  tutorName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },
  subjectText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing['1'],
  },
  timeIcon: { fontSize: 12 },
  timeText: {
    fontSize: typography.size.xs, color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },

  joinBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    borderRadius: radius.md,
    alignItems: 'center',
    minWidth: 70,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  joinBtnWaiting: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  joinBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
  joinBtnTextWaiting: {
    color: colors.textMuted,
  },
});

export default StudentLiveClass;
