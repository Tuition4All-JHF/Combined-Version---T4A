import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { adminApi } from '../../api/adminApi';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

const getStatusConfig = (colors: any):  Record<string, { color: string; bg: string }>  => ({
  PAID:    { color: colors.success, bg: colors.successBg },
  PENDING: { color: colors.warning, bg: colors.warningBg },
  FAILED:  { color: colors.error,   bg: colors.errorBg },
});

export default function AdminPayments() {
  const { colors } = useTheme();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getPayments().then((data) => {
      setPayments(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalRevenue = payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);

  const s = createStyles(colors);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Payment Logs</Text>
        <Text style={s.headerSub}>{payments.length} transaction{payments.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Revenue summary */}
      {payments.length > 0 && (
        <View style={s.revenueBanner}>
          <View>
            <Text style={s.revenueLabel}>Total Revenue</Text>
            <Text style={s.revenueAmount}>₹{totalRevenue.toLocaleString('en-IN')}</Text>
          </View>
          <View style={s.revenueIcon}>
            <Text style={{ fontSize: 28 }}>💳</Text>
          </View>
        </View>
      )}

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>💰</Text>
            <Text style={s.emptyTitle}>No payments yet</Text>
            <Text style={s.emptyText}>Payment records will appear here once transactions are made.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusConf = getStatusConfig(colors)[item.status] || { color: colors.textSecondary, bg: colors.surface };
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.bookingIdBadge}>
                  <Text style={s.bookingIdText}>Booking #{item.booking_id}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusConf.bg, borderColor: statusConf.color + '40' }]}>
                  <Text style={[s.statusText, { color: statusConf.color }]}>{item.status}</Text>
                </View>
              </View>

              <View style={s.amountRow}>
                <Text style={s.amount}>₹{parseFloat(item.amount || 0).toLocaleString('en-IN')}</Text>
              </View>

              <View style={s.divider} />

              <View style={s.detailsRow}>
                <View style={s.detailItem}>
                  <Text style={s.detailLabel}>Student</Text>
                  <Text style={s.detailValue}>🎓 {item.student || '—'}</Text>
                </View>
                <View style={s.detailItem}>
                  <Text style={s.detailLabel}>Tutor</Text>
                  <Text style={s.detailValue}>📚 {item.tutor || '—'}</Text>
                </View>
              </View>

              <Text style={s.dateText}>
                {new Date(item.created_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center', gap: spacing['3'],
  },
  loadingText: { color: colors.textSecondary, fontSize: typography.size.sm },

  header: {
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  headerSub: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },

  revenueBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    margin: spacing['4'],
    borderRadius: radius.xl,
    padding: spacing['5'],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  revenueLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
  },
  revenueAmount: {
    color: colors.white,
    fontSize: typography.size['4xl'],
    fontWeight: typography.weight.black,
    marginTop: spacing['1'],
    letterSpacing: typography.tracking.tight,
  },
  revenueIcon: {
    width: 56, height: 56,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: { padding: spacing['4'], paddingBottom: spacing['8'], gap: spacing['3'] },

  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['2'], textAlign: 'center' },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['3'],
  },
  bookingIdBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bookingIdText: { color: colors.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderWidth: 1,
  },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.weight.extrabold },
  amountRow: { marginBottom: spacing['3'] },
  amount: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.black,
    color: colors.text,
    letterSpacing: typography.tracking.tight,
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginBottom: spacing['3'] },
  detailsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['2'] },
  detailItem: { flex: 1 },
  detailLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.bold,
    color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider, marginBottom: 2,
  },
  detailValue: { fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.medium },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: spacing['1'] },
});
