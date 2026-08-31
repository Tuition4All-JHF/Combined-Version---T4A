import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, Image, StatusBar,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';

import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../redux/store';
import { logout } from '../../redux/authSlice';

const TutorPublicProfile = ({ route, navigation }: any) => {
  const { tutor } = route.params;
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const { user, isGuest } = useSelector((state: RootState) => state.auth);
  const isParent = user?.role === 'PARENT';

  const [showBookModal, setShowBookModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    tutor.subjects[0]?.id || null
  );
  const [booking, setBooking] = useState(false);

  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);

  // Group slots by batch_id and time for display, but only first slot of each batch time is shown in list
  const getBatchedSlots = () => {
    const seen = new Set<string>();
    return slots.filter(s => {
      if (selectedSubjectId && s.subject_id !== selectedSubjectId) return false;
      if (!s.batch_id) return true;
      const timeStr = new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const key = `${s.batch_id}_${timeStr}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const [myBookings, setMyBookings] = useState<any[]>([]);

  React.useEffect(() => {
    setLoadingSlots(true);
    apiClient.get(`schedule-slots/?tutor_id=${tutor.user_id}`)
      .then(res => setSlots(res.data))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));

    if (!isGuest && !isParent) {
      apiClient.get('bookings/')
        .then(res => setMyBookings(res.data))
        .catch(err => console.error('Error fetching bookings', err));
    }

    if (isParent) {
      apiClient.get('auth/parent/children/')
        .then(res => {
          setChildren(res.data);
          if (res.data.length > 0) setSelectedChildId(res.data[0].id);
        })
        .catch(err => console.error('Error fetching children', err));
    }
  }, [tutor.user_id, isParent, isGuest]);

  const handleGuestAction = () => {
    Alert.alert(
      "Login Required",
      "You need to login or create an account to use this feature.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => dispatch(logout()) }
      ]
    );
  };

  const executeBooking = () => {
    setBooking(true);
    apiClient.post('bookings/create/', {
      tutor_id: tutor.user_id,
      subject_id: selectedSubjectId,
      time_slot_id: selectedSlotId,
      student_id: selectedChildId,
      notes,
    })
      .then(() => {
        setShowBookModal(false);
        Alert.alert('🎉 Booked Successfully!', 'Your session has been booked and confirmed.');
      })
      .catch((err) => {
        const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Could not book class. Please try again.';
        Alert.alert('Error', errorMsg);
      })
      .finally(() => setBooking(false));
  };

  const handleBook = () => {
    if (isGuest) {
      handleGuestAction();
      return;
    }
    if (isParent && !selectedChildId) {
      Alert.alert('Error', 'Please select a child for this booking.');
      return;
    }
    if (!selectedSubjectId) {
      Alert.alert('Error', 'Please select a subject.');
      return;
    }
    if (!selectedSlotId) {
      Alert.alert('Error', 'Please select a time slot.');
      return;
    }

    // Collision Check
    const selectedSlot = slots.find(s => s.id === selectedSlotId);
    if (selectedSlot && !isParent) {
      const selectedStart = new Date(selectedSlot.start_time).getTime();
      const selectedEnd = new Date(selectedSlot.end_time).getTime();

      const collision = myBookings.find(b => {
        if (b.status === 'CANCELLED') return false;
        const bStart = new Date(b.start_time).getTime();
        const bEnd = new Date(b.end_time).getTime();
        return (selectedStart < bEnd && selectedEnd > bStart);
      });

      if (collision) {
        Alert.alert(
          'Time Collision Warning',
          'You already have a session booked at this time. Do you want to proceed anyway or cancel?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed', onPress: executeBooking, style: 'destructive' }
          ]
        );
        return;
      }
    }

    executeBooking();
  };

  const handleChat = () => {
    if (isGuest) {
      handleGuestAction();
      return;
    }
    apiClient.post('chat/rooms/', { tutor_id: tutor.user_id })
      .then(res => {
        navigation.navigate('ChatScreen', {
          room: res.data,
          otherId: tutor.user_id,
          otherName: tutor.first_name ? `${tutor.first_name} ${tutor.last_name || ''}`.trim() : tutor.username,
        });
      })
      .catch(() => Alert.alert('Error', 'Could not open chat.'));
  };

  const ratingNum = parseFloat(tutor.rating) || 0;
  const fullStars = Math.floor(ratingNum);

  const s = createStyles(colors, isDark);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Banner */}
        <View style={s.banner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              {tutor.profile_photo ? (
                <Image source={{ uri: tutor.profile_photo }} style={s.avatarImage} />
              ) : (
                <Text style={s.avatarText}>{(tutor.first_name || tutor.username || 'U')[0].toUpperCase()}</Text>
              )}
            </View>
          </View>
          <Text style={s.name}>{tutor.first_name ? `${tutor.first_name} ${tutor.last_name || ''}`.trim() : tutor.username}</Text>
          <View style={s.ratingRow}>
            {[...Array(5)].map((_, i) => (
              <Text key={i} style={[s.star, i < fullStars && s.starFilled]}>★</Text>
            ))}
            <Text style={s.ratingNum}>{tutor.rating || '0.0'}</Text>
            <Text style={s.expBullet}>·</Text>
            <Text style={s.exp}>{tutor.experience_years} yrs exp</Text>
          </View>
          <View style={[s.verifiedBadge, { marginTop: spacing['3'], alignSelf: 'center' }]}>
            <Text style={s.verifiedText}>✓ Verified Tutor</Text>
          </View>
        </View>

        <View style={s.body}>

          {/* Intro Video */}
          {tutor.intro_video ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Intro Video</Text>
              <View style={s.videoContainer}>
                <IntroVideoPlayer videoUrl={tutor.intro_video} style={s.videoPlayer} />
              </View>
            </View>
          ) : null}

          {/* About */}
          {tutor.bio ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>About</Text>
              <View style={s.infoBlock}>
                <Text style={s.infoBlockLabel}>BIO</Text>
                <Text style={s.infoBlockText}>{tutor.bio}</Text>
              </View>
            </View>
          ) : null}

          {/* Qualifications */}
          {tutor.qualifications ? (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Qualifications</Text>
              <View style={s.infoBlock}>
                <Text style={s.infoBlockLabel}>CREDENTIALS</Text>
                <Text style={s.infoBlockText}>{tutor.qualifications}</Text>
              </View>
            </View>
          ) : null}

          {/* Subjects */}
          {tutor.subjects.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Subjects & Rates</Text>
              <View style={{ gap: spacing['3'] }}>
                {tutor.subjects.map((subj: any) => {
                  const hourly = Number(subj.hourly_rate) || 0;
                  const duration = Number(subj.course_duration_hours) || 0;
                  const totalFee = hourly * duration;
                  return (
                    <View key={subj.id} style={{
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: spacing['3'],
                      borderWidth: 1,
                      borderColor: colors.border
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.primary }}>
                          {subj.subject_name || subj.name}
                        </Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text }}>
                            ₹{totalFee}
                          </Text>
                          <Text style={{ fontSize: typography.size.xs, color: colors.textSecondary }}>Total Fee</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['2'], paddingTop: spacing['2'], borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
                        <Text style={{ fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.semibold }}>
                          ₹{hourly}/hr
                        </Text>
                        <Text style={{ fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: typography.weight.semibold }}>
                          ⏱ {duration} hours
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ height: spacing['8'] }} />
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={s.actions}>
        <TouchableOpacity style={s.chatBtn} onPress={handleChat} activeOpacity={0.8}>
          <Text style={s.chatBtnText}>💬  Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.bookBtn} onPress={() => setShowBookModal(true)} activeOpacity={0.85}>
          <Text style={s.bookBtnText}>📅  Book Session</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      <Modal visible={showBookModal} animationType="slide" transparent onRequestClose={() => setShowBookModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Book a Session</Text>
            <Text style={s.modalSub}>with {tutor.username}</Text>

            <Text style={s.modalLabel}>Select Subject</Text>
            <View style={s.subjectRow}>
              {tutor.subjects.map((subj: any) => (
                <TouchableOpacity
                  key={subj.id}
                  style={[s.subjectTag, selectedSubjectId === subj.id && s.subjectTagActive]}
                  onPress={() => setSelectedSubjectId(subj.id)}
                >
                  <Text style={[s.subjectTagText, selectedSubjectId === subj.id && s.subjectTagTextActive]}>
                    {subj.subject_name || subj.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {isParent && (
              <>
                <Text style={s.modalLabel}>Book For Child</Text>
                {children.length > 0 ? (
                  <View style={s.subjectRow}>
                    {children.map((child: any) => (
                      <TouchableOpacity
                        key={child.id}
                        style={[s.subjectTag, selectedChildId === child.id && s.subjectTagActive]}
                        onPress={() => setSelectedChildId(child.id)}
                      >
                        <Text style={[s.subjectTagText, selectedChildId === child.id && s.subjectTagTextActive]}>
                          {child.username}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noSlotsText}>No children linked. Please link a child in your dashboard.</Text>
                )}
              </>
            )}

            <Text style={s.modalLabel}>Available Time Slots</Text>
            {loadingSlots ? (
              <Text style={s.loadingText}>Loading slots...</Text>
            ) : getBatchedSlots().filter(slot => slot.subject === selectedSubjectId || !slot.subject).length === 0 ? (
              <Text style={s.noSlotsText}>No available slots for this subject.</Text>
            ) : (
              <ScrollView style={s.slotsContainer} nestedScrollEnabled={true}>
                {getBatchedSlots().filter(slot => slot.subject === selectedSubjectId || !slot.subject).map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[s.slotCard, isSelected && s.slotCardActive]}
                      onPress={() => setSelectedSlotId(slot.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={[s.slotSubject, isSelected && s.slotTextActive]}>
                          {isSelected ? '✅ ' : ''}{slot.subject_name || 'General'}
                        </Text>
                        <View style={[s.sessionTypeBadge, slot.session_type === 'ONE_TO_MANY' ? s.manyTypeBadge : s.oneTypeBadge]}>
                          <Text style={s.sessionTypeBadgeText}>
                            {slot.session_type === 'ONE_TO_MANY' ? `👥 Group (${slot.booked_seats || 0}/${slot.max_students} booked)` : '👤 Private'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[s.slotDate, isSelected && s.slotTextActive]}>
                        📅 {new Date(slot.start_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                      <Text style={[s.slotTime, isSelected && s.slotTextActive]}>
                        ⏰ {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {slot.batch_label && (
                        <Text style={s.batchTag}>🔁 {slot.batch_label}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {selectedSlotId && slots.find(s => s.id === selectedSlotId)?.batch_id && (
              <Text style={s.batchWarning}>
                ℹ️ This is a batch session. Booking reserves all sessions in the series.
              </Text>
            )}
            <Text style={s.modalLabel}>Notes (optional)</Text>
            <TextInput
              style={s.notesInput}
              multiline
              placeholder="e.g. I need help with calculus..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
            />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowBookModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleBook} disabled={booking} activeOpacity={0.85}>
                <Text style={s.confirmText}>{booking ? 'Booking...' : 'Book Slot'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Banner
  banner: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    paddingTop: spacing['10'],
    paddingBottom: spacing['8'],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    position: 'absolute',
    top: spacing['10'],
    left: spacing['5'],
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
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing['3'],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 86, height: 86 },
  avatarText: { color: colors.primary, fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold },
  name: {
    color: colors.text,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold,
    letterSpacing: typography.tracking.tight,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing['2'] },
  star: { fontSize: 16, color: colors.textMuted },
  starFilled: { color: colors.warning },
  ratingNum: { color: colors.textSecondary, fontSize: typography.size.sm, marginLeft: spacing['2'] },
  expBullet: { color: colors.textMuted, marginHorizontal: spacing['2'] },
  exp: { color: colors.textSecondary, fontSize: typography.size.sm },

  body: { padding: spacing['4'] },

  rateCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    marginBottom: spacing['3'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateLabel: { fontSize: typography.size.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: typography.tracking.widest },
  rate: { fontSize: typography.size['3xl'], fontWeight: typography.weight.black, color: colors.primary, marginTop: 2 },
  rateSub: { fontSize: typography.size.base, fontWeight: typography.weight.regular, color: colors.textSecondary },
  verifiedBadge: {
    backgroundColor: colors.successBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'],
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  verifiedText: { color: colors.success, fontSize: typography.size.xs, fontWeight: typography.weight.bold },

  section: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing['4'],
    marginBottom: spacing['3'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    marginBottom: spacing['2'],
  },
  sectionText: { fontSize: typography.size.md, color: colors.text, lineHeight: typography.lineHeight.relaxed },

  // Admin-style InfoBlock — purple left border card
  infoBlock: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing['3'],
    marginTop: spacing['1'],
  },
  infoBlockLabel: {
    color: colors.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing['2'],
  },
  infoBlockText: {
    color: colors.text,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },

  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] },
  subjectTag: {
    borderWidth: 1.5,
    borderColor: colors.primary + '25',
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
    backgroundColor: colors.primary + '10',
  },
  subjectTagActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  subjectTagText: { color: colors.primary, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  subjectTagTextActive: { color: colors.primaryDark, fontWeight: typography.weight.bold },

  videoContainer: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', marginTop: spacing['2'] },
  videoPlayer: { width: '100%', height: 200 },

  // Actions bar
  actions: {
    flexDirection: 'row',
    padding: spacing['4'],
    gap: spacing['3'],
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  chatBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
  },
  chatBtnText: { color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.base },
  bookBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  bookBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: spacing['6'],
    paddingBottom: spacing['10'],
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.textMuted,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing['5'],
  },
  modalTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  modalSub: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing['4'] },
  modalLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest,
    marginBottom: spacing['2'],
    marginTop: spacing['4'],
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing['3'],
    height: 90,
    textAlignVertical: 'top',
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: typography.size.sm,
  },
  modalActions: { flexDirection: 'row', gap: spacing['3'], marginTop: spacing['5'] },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: typography.weight.semibold },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  loadingText: { color: colors.textSecondary, fontStyle: 'italic', fontSize: typography.size.sm },
  noSlotsText: { color: colors.error, fontStyle: 'italic', fontSize: typography.size.sm },
  slotsContainer: { maxHeight: 200, marginBottom: spacing['3'] },
  slotCard: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing['4'],
    marginBottom: spacing['3'],
  },
  slotCardActive: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  slotSubject: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
    marginBottom: 2,
  },
  slotDate: {
    color: colors.text,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.base,
    marginTop: 0,
  },
  slotTime: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 2,
  },
  slotTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.weight.extrabold,
  },
  batchTag: { fontSize: typography.size.xs, color: colors.warning, fontWeight: typography.weight.bold, marginTop: 4 },
  batchWarning: { fontSize: typography.size.xs, color: colors.warning, marginBottom: spacing['3'], fontStyle: 'italic' },

  sessionTypeBadge: { borderRadius: radius.full, paddingHorizontal: spacing['2'], paddingVertical: 2, borderWidth: 1 },
  oneTypeBadge: { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' },
  manyTypeBadge: { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' },
  sessionTypeBadgeText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
});

// Isolated sub-component so useVideoPlayer hook only runs when a video URL exists.
// Placing it here (outside TutorPublicProfile) ensures the hook is only mounted
// when <IntroVideoPlayer> is actually rendered, avoiding the
// "Cannot use shared object that was already released" crash.
const IntroVideoPlayer = ({ videoUrl, style }: { videoUrl: string; style: any }) => {
  const player = useVideoPlayer(videoUrl);
  return (
    <VideoView
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      style={style}
    />
  );
};

export default TutorPublicProfile;
