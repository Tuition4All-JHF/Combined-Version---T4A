import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';

const Reviews = () => {
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    apiClient.get('reviews/my/')
      .then(res => {
        setReviews(res.data);
        if (res.data.length > 0) {
          const avg = res.data.reduce((acc: number, r: any) => acc + r.rating, 0) / res.data.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      })
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const renderStars = (rating: number) => {
    return [1, 2, 3, 4, 5].map(i => (
      <Text key={i} style={[s.star, i <= Math.round(rating) && s.starFilled]}>★</Text>
    ));
  };

  const s = createStyles(colors);

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Reviews</Text>
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Rating Summary */}
        {!loading && (
          <View style={s.ratingCard}>
            <View style={s.ratingLeft}>
              <Text style={s.ratingBig}>{avgRating || '—'}</Text>
              <View style={s.starsRow}>{renderStars(avgRating)}</View>
              <Text style={s.ratingCount}>
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={s.ratingRight}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = reviews.filter((r: any) => Math.round(r.rating) === star).length;
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <View key={star} style={s.barRow}>
                    <Text style={s.barLabel}>{star}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={s.barCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
        ) : reviews.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>No reviews yet</Text>
            <Text style={s.emptyText}>Students will leave reviews after their sessions.</Text>
          </View>
        ) : (
          reviews.map((r: any) => (
            <View key={r.id} style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.reviewerRow}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {r.student_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.reviewer}>{r.student_name}</Text>
                    <Text style={s.date}>
                      {new Date(r.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={s.starsRow}>{renderStars(r.rating)}</View>
              </View>
              {r.comment ? (
                <Text style={s.comment}>"{r.comment}"</Text>
              ) : null}
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

  container: { padding: spacing['4'], paddingBottom: spacing['8'] },

  // Rating card
  ratingCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['5'],
    marginBottom: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    gap: spacing['4'],
  },
  ratingLeft: { alignItems: 'center', justifyContent: 'center', width: 90 },
  ratingBig: {
    fontSize: typography.size['5xl'],
    fontWeight: typography.weight.black,
    color: colors.text,
    lineHeight: 52,
  },
  starsRow: { flexDirection: 'row', gap: 1, marginVertical: spacing['1'] },
  star: { fontSize: 13, color: colors.textMuted },
  starFilled: { color: colors.warning },
  ratingCount: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  ratingRight: { flex: 1, justifyContent: 'center', gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
  barLabel: { fontSize: typography.size.xs, color: colors.textMuted, width: 10, textAlign: 'right' },
  barTrack: {
    flex: 1, height: 6, backgroundColor: colors.surface,
    borderRadius: radius.full, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.warning, borderRadius: radius.full },
  barCount: { fontSize: typography.size.xs, color: colors.textMuted, width: 16, textAlign: 'right' },

  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginTop: spacing['2'], textAlign: 'center',
  },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing['4'],
    marginBottom: spacing['3'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing['3'],
  },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['3'] },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '25',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary + '50',
  },
  avatarText: { color: colors.primary, fontSize: typography.size.base, fontWeight: typography.weight.extrabold },
  reviewer: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text },
  date: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  comment: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight.relaxed,
    fontStyle: 'italic',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary + '40',
    paddingLeft: spacing['3'],
    marginTop: spacing['1'],
  },
});

export default Reviews;
