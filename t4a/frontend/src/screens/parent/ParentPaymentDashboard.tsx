import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

const ParentPaymentDashboard = () => {
  const { colors } = useTheme();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    apiClient.get('parent/payment-history/')
      .then(res => setPayments(res.data))
      .catch(err => console.error('Error fetching payments', err))
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
        <Text style={s.headerTitle}>Payment History</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {payments.length > 0 ? (
          payments.map((p, idx) => (
            <View key={idx} style={s.paymentCard}>
              <View style={s.cardHeader}>
                <Text style={s.subjectText}>{p.subject}</Text>
                <Text style={[s.statusBadge, p.status === 'COMPLETED' ? s.statusCompleted : s.statusPending]}>
                  {p.status}
                </Text>
              </View>
              <Text style={s.amountText}>${p.amount}</Text>
              <View style={s.detailsRow}>
                <Text style={s.detailText}>Student: {p.student_name}</Text>
                <Text style={s.detailText}>Tutor: {p.tutor_name}</Text>
              </View>
              <Text style={s.dateText}>{new Date(p.created_at).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No payment history found.</Text>
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

  paymentCard: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], marginBottom: spacing['3'],
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] },
  subjectText: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text },
  statusBadge: { 
    fontSize: typography.size.xs, fontWeight: typography.weight.bold, 
    paddingHorizontal: spacing['2'], paddingVertical: 4, borderRadius: radius.sm, overflow: 'hidden'
  },
  statusCompleted: { backgroundColor: colors.success + '20', color: colors.success },
  statusPending: { backgroundColor: colors.warning + '20', color: colors.warning },
  amountText: { fontSize: typography.size['2xl'], fontWeight: typography.weight.black, color: colors.primary, marginBottom: spacing['2'] },
  
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing['2'] },
  detailText: { fontSize: typography.size.sm, color: colors.textSecondary },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted },

  emptyState: { alignItems: 'center', marginTop: spacing['10'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.base },
});

export default ParentPaymentDashboard;
