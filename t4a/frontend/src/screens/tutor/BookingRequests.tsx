import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

// Groups multiple booking objects that share a batch_id into one representative card.
// Returns an array of "display items" – either a single booking or a merged batch.
function groupByBatch(requests: any[]): any[] {
  const batchMap: Record<string, any[]> = {};
  const result: any[] = [];

  for (const req of requests) {
    const batchId = req.time_slot?.batch_id;
    if (!batchId) {
      result.push({ type: 'single', booking: req });
    } else {
      if (!batchMap[batchId]) batchMap[batchId] = [];
      batchMap[batchId].push(req);
    }
  }

  for (const batchId of Object.keys(batchMap)) {
    const group = batchMap[batchId].sort(
      (a, b) => new Date(a.time_slot.start_time).getTime() - new Date(b.time_slot.start_time).getTime()
    );
    result.push({ type: 'batch', bookings: group, batchId });
  }

  // Sort by earliest booking date
  result.sort((a, b) => {
    const dateA = a.type === 'single'
      ? new Date(a.booking.booking_date).getTime()
      : new Date(a.bookings[0].booking_date).getTime();
    const dateB = b.type === 'single'
      ? new Date(b.booking.booking_date).getTime()
      : new Date(b.bookings[0].booking_date).getTime();
    return dateB - dateA;
  });

  return result;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const BookingRequests = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = () => {
    setLoading(true);
    apiClient.get('bookings/?status=CONFIRMED')
      .then(res => setRequests(res.data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useFocusEffect(useCallback(() => { fetchRequests(); }, []));

  // For single booking action
  const handleAction = (id: number, action: 'CONFIRMED' | 'CANCELLED') => {
    apiClient.patch(`bookings/${id}/`, { status: action })
      .then(() => {
        Alert.alert(
          action === 'CONFIRMED' ? '✅ Accepted!' : '❌ Declined',
          action === 'CONFIRMED' ? 'The student has been notified.' : 'The booking has been declined.'
        );
        fetchRequests();
      })
      .catch(() => Alert.alert('Error', 'Could not update booking. Please try again.'));
  };

  // For batch action: update all bookings in the group
  const handleBatchAction = (ids: number[], action: 'CONFIRMED' | 'CANCELLED') => {
    Promise.all(ids.map(id => apiClient.patch(`bookings/${id}/`, { status: action })))
      .then(() => {
        Alert.alert(
          action === 'CONFIRMED' ? '✅ Batch Accepted!' : '❌ Batch Declined',
          action === 'CONFIRMED'
            ? 'All sessions in this batch have been confirmed.'
            : 'All sessions in this batch have been declined.'
        );
        fetchRequests();
      })
      .catch(() => Alert.alert('Error', 'Could not update all bookings.'));
  };

  const grouped = groupByBatch(requests);

  const s = createStyles(colors);

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>My Bookings</Text>
          {grouped.length > 0 && (
            <Text style={s.headerSub}>{grouped.length} confirmed</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
        ) : grouped.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyTitle}>No bookings</Text>
            <Text style={s.emptyText}>
              When students book a session with you, they will appear here.
            </Text>
          </View>
        ) : (
          grouped.map((item, idx) => {
            if (item.type === 'single') {
              const req = item.booking;
              const slot = req.time_slot;
              return (
                <View key={req.id} style={s.card}>
                  {/* Student row */}
                  <StudentRow req={req} s={s} />

                  <View style={s.cardDivider} />

                  {/* Session type badge */}
                  <View style={s.sessionBadge}>
                    <Text style={s.sessionBadgeText}>📌 Single Session</Text>
                  </View>

                  {/* Slot detail */}
                  {slot ? (
                    <View style={s.slotBox}>
                      <Text style={s.slotSubject}>
                        📚 {slot.subject_name || req.subject_name || 'No subject'}
                      </Text>
                      <Text style={s.slotDateTime}>
                        📅 {fmt(slot.start_time)}
                        {'  '}⏰ {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.noSlot}>No slot details available.</Text>
                  )}

                  {/* Notes */}
                  <NoteRow notes={req.notes} s={s} />

                  {/* Actions */}
                  <ActionRow s={s} onStart={() => navigation.navigate('LiveSessionScreen', { roomId: req.time_slot.room_name, timeSlotId: req.time_slot.id, isTutor: true })} />
                </View>
              );
            }

            // BATCH card
            const { bookings } = item;
            const firstReq = bookings[0];
            const firstSlot = firstReq.time_slot;
            const lastSlot = bookings[bookings.length - 1].time_slot;
            const batchLabel = firstSlot?.batch_label;
            const recurrenceType = firstSlot?.recurrence_type;
            const ids = bookings.map((b: any) => b.id);

            return (
              <View key={item.batchId} style={[s.card, s.batchCard]}>
                {/* Student row */}
                <StudentRow req={firstReq} s={s} />

                <View style={s.cardDivider} />

                {/* Session type badge */}
                <View style={[s.sessionBadge, s.batchBadge]}>
                  <Text style={[s.sessionBadgeText, s.batchBadgeText]}>
                    {recurrenceType === 'WEEKLY' ? '📆 Weekly Batch' : '🗓️ Monthly Batch'}
                    {'  '}·{'  '}{bookings.length} Sessions
                  </Text>
                </View>

                {/* Batch summary */}
                {firstSlot && (
                  <View style={s.slotBox}>
                    <Text style={s.slotSubject}>
                      📚 {firstSlot.subject_name || firstReq.subject_name || 'No subject'}
                    </Text>
                    {batchLabel && (
                      <Text style={s.batchLabelText}>🔁 {batchLabel}</Text>
                    )}
                    <Text style={s.slotDateTime}>
                      ⏰ Class time: {fmtTime(firstSlot.start_time)} – {fmtTime(firstSlot.end_time)}
                    </Text>
                    <Text style={s.slotDateTime}>
                      📅 From: {fmt(firstSlot.start_time)}
                    </Text>
                    {lastSlot && (
                      <Text style={s.slotDateTime}>
                        📅 To: {fmt(lastSlot.start_time)}
                      </Text>
                    )}
                  </View>
                )}

                {/* All session dates */}
                <View style={s.sessionListBox}>
                  <Text style={s.sessionListTitle}>All class dates:</Text>
                  <View style={s.sessionChips}>
                    {bookings.map((b: any, i: number) => (
                      <View key={b.id} style={s.sessionChip}>
                        <Text style={s.sessionChipText}>
                          {new Date(b.time_slot?.start_time).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <NoteRow notes={firstReq.notes} s={s} />

                {/* Actions */}
                <ActionRow s={s} onStart={() => navigation.navigate('LiveSessionScreen', { roomId: firstSlot.room_name, timeSlotId: firstSlot.id, isTutor: true })} />
              </View>
            );
          })
        )}
        <View style={{ height: spacing['8'] }} />
      </ScrollView>
    </View>
  );
};

/* ── Small reusable sub-components ─────────────────────────── */

const StudentRow = ({ req, s }: any) => (
  <View style={s.studentRow}>
    <View style={s.avatar}>
      <Text style={s.avatarText}>
        {req.student_name?.[0]?.toUpperCase() || '?'}
      </Text>
    </View>
    <View style={s.studentInfo}>
      <Text style={s.studentName}>
        {req.student_name}
        {req.via_parent ? <Text style={s.viaParentText}> (via Parent)</Text> : null}
      </Text>
      <Text style={s.requestedAt}>
        Requested{' '}
        {new Date(req.booking_date).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </Text>
    </View>
    <View style={s.confirmedBadge}>
      <Text style={s.confirmedText}>CONFIRMED</Text>
    </View>
  </View>
);

const NoteRow = ({ notes, s }: { notes?: string; s: any }) => (
  <View style={s.noteRow}>
    <Text style={s.noteIcon}>💬</Text>
    <View style={{ flex: 1 }}>
      <Text style={s.detailLabel}>Student Note</Text>
      <Text style={s.noteText} numberOfLines={3}>
        {notes?.trim() ? notes.replace('\n(Via Parent Account)', '').replace('(Via Parent Account)', '').trim() : 'No message provided'}
      </Text>
    </View>
  </View>
);

const ActionRow = ({ onStart, s }: { onStart: () => void; s: any }) => (
  <View style={s.actions}>
    <TouchableOpacity style={s.acceptBtn} onPress={onStart} activeOpacity={0.85}>
      <Text style={s.acceptText}>▶ Start Live Stream</Text>
    </TouchableOpacity>
  </View>
);

/* ── Styles ─────────────────────────────────────────────────── */

const createStyles = (colors: any) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'], paddingBottom: spacing['4'], paddingHorizontal: spacing['5'],
    borderBottomWidth: 1, borderColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: typography.weight.bold },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  headerSub: { fontSize: typography.size.sm, color: colors.success, marginTop: 2, fontWeight: typography.weight.medium },

  container: { flex: 1, padding: spacing['4'] },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginTop: spacing['2'], textAlign: 'center', paddingHorizontal: spacing['4'],
  },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    marginBottom: spacing['4'],
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.glassBorder,
    borderLeftColor: colors.success,
  },
  batchCard: { borderLeftColor: colors.primary },

  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'] },
  avatar: {
    width: 48, height: 48, borderRadius: radius.full,
    backgroundColor: colors.accent + '30',
    justifyContent: 'center', alignItems: 'center', marginRight: spacing['3'],
    borderWidth: 2, borderColor: colors.accent + '50',
  },
  avatarText: { color: colors.accent, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
  studentInfo: { flex: 1 },
  studentName: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text },
  viaParentText: { fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: typography.weight.medium },
  requestedAt: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  confirmedBadge: {
    backgroundColor: colors.successBg, borderRadius: radius.full,
    paddingHorizontal: spacing['3'], paddingVertical: 3,
    borderWidth: 1, borderColor: colors.success + '40',
  },
  confirmedText: { color: colors.success, fontSize: 9, fontWeight: typography.weight.extrabold, letterSpacing: 1 },

  cardDivider: { height: 1, backgroundColor: colors.borderSubtle, marginBottom: spacing['3'] },

  // Session type badge
  sessionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'], paddingVertical: spacing['1'],
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing['3'],
  },
  batchBadge: { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' },
  sessionBadgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.textSecondary },
  batchBadgeText: { color: colors.primary },

  // Slot info box
  slotBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing['3'],
    marginBottom: spacing['3'],
    gap: spacing['2'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotSubject: {
    fontSize: typography.size.sm, fontWeight: typography.weight.extrabold, color: colors.text,
  },
  batchLabelText: {
    fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.bold,
  },
  slotDateTime: {
    fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.medium,
  },
  noSlot: { fontSize: typography.size.sm, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing['3'] },

  // All session dates (batch)
  sessionListBox: {
    marginBottom: spacing['3'],
  },
  sessionListTitle: {
    fontSize: typography.size.xs, fontWeight: typography.weight.bold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing['2'],
  },
  sessionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] },
  sessionChip: {
    backgroundColor: colors.primary + '12',
    borderRadius: radius.sm,
    paddingHorizontal: spacing['2'], paddingVertical: 3,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  sessionChipText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.bold },

  // Note row
  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing['3'], gap: spacing['2'],
    marginBottom: spacing['3'], borderWidth: 1, borderColor: colors.border,
  },
  noteIcon: { fontSize: 16, marginTop: 1 },
  detailLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.bold,
    color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider, marginBottom: 2,
  },
  noteText: { fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.medium, lineHeight: typography.lineHeight.normal },

  actions: { flexDirection: 'row', gap: spacing['3'] },
  declineBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.error + '60',
    padding: spacing['3'], borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.errorBg,
  },
  declineText: { color: colors.error, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  acceptBtn: {
    flex: 2, backgroundColor: colors.primary,
    padding: spacing['3'], borderRadius: radius.md, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  acceptText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
});

export default BookingRequests;
