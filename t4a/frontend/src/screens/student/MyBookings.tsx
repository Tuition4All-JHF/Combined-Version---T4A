import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

const getStatusConfig = (colors: any):  Record<string, { color: string; bg: string; label: string; icon: string }>  => ({
  PENDING:   { color: colors.warning,   bg: colors.warningBg,   label: 'Pending',   icon: '⏳' },
  CONFIRMED: { color: colors.success,   bg: colors.successBg,   label: 'Confirmed', icon: '✅' },
  CANCELLED: { color: colors.error,     bg: colors.errorBg,     label: 'Cancelled', icon: '❌' },
  COMPLETED: { color: colors.accent,    bg: colors.infoBg,      label: 'Completed', icon: '🎓' },
});

const MyBookings = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = () => {
    setLoading(true);
    apiClient.get('bookings/')
      .then(res => setBookings(res.data))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };

  useFocusEffect(useCallback(() => { fetchBookings(); }, []));

  const s = createStyles(colors);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>My Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
      ) : bookings.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyTitle}>No bookings yet</Text>
          <Text style={s.emptyText}>Book a session with a tutor to get started!</Text>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => navigation.navigate('SearchTutors')}
            activeOpacity={0.85}
          >
            <Text style={s.ctaBtnText}>Find a Tutor</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const status = getStatusConfig(colors)[item.status] || {
              color: colors.textSecondary, bg: colors.surface, label: item.status, icon: '•',
            };
            return (
              <View style={[s.card, { borderLeftColor: status.color }]}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={s.tutorName}>{item.tutor_name}</Text>
                    <Text style={s.dateText}>
                      Requested: {new Date(item.booking_date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: status.bg, borderColor: status.color + '40' }]}>
                    <Text style={s.badgeIcon}>{status.icon}</Text>
                    <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={s.divider} />

                <View style={s.detailRow}>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Subject</Text>
                    <Text style={s.detailValue}>📚 {item.course_name}</Text>
                  </View>
                  <View style={s.detailItem}>
                    <Text style={s.detailLabel}>Date & Time</Text>
                    <Text style={s.detailValue}>
                      🕒 {new Date(item.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                
                {item.notes ? (
                  <View style={[s.detailRow, { marginTop: 12 }]}>
                    <View style={s.detailItem}>
                      <Text style={s.detailLabel}>Note</Text>
                      <Text style={s.detailValue} numberOfLines={1}>📝 {item.notes}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

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
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: typography.weight.bold },
  title: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },

  emptyBox: { alignItems: 'center', marginTop: 80, padding: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing['2'],
    textAlign: 'center',
    marginBottom: spacing['5'],
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['6'],
    paddingVertical: spacing['3'],
    borderRadius: radius.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  listContent: { padding: spacing['4'], gap: spacing['3'] },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tutorName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeIcon: { fontSize: 11 },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },

  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing['3'],
  },
  detailRow: { flexDirection: 'row', gap: spacing['4'] },
  detailItem: { flex: 1 },
  detailLabel: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: 2,
  },
  detailValue: { fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.medium },
});

export default MyBookings;
