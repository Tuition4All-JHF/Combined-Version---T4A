import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, StatusBar, TextInput,
  FlatList,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ScheduleSlot {
  id: number;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  subject_name?: string;
  batch_id?: string;
  recurrence_type?: string;
  batch_label?: string;
  session_type?: 'ONE_TO_ONE' | 'ONE_TO_MANY';
  max_students?: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SlotCardView = React.memo(({ slot, isSelected, s, toggleSlotSelection, handleDeleteSlot, spacing }: any) => {
  return (
    <View style={[s.slotCard, isSelected && s.slotCardSelected]}>
      {!slot.is_booked && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[s.checkbox, isSelected && s.checkboxSelected]}
          onPress={() => toggleSlotSelection(slot.id)}
        >
          {isSelected && <Text style={s.checkboxIcon}>✓</Text>}
        </TouchableOpacity>
      )}
      <View style={{ flex: 1, marginLeft: slot.is_booked ? 0 : spacing['2'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing['2'], marginBottom: 2 }}>
          <Text style={s.slotSubject}>{slot.subject_name || 'No Subject'}</Text>
          <View style={[s.sessionBadge, slot.session_type === 'ONE_TO_MANY' ? s.manyBadge : s.oneBadge]}>
            <Text style={s.sessionBadgeText}>
              {slot.session_type === 'ONE_TO_MANY' ? `👥 1-to-Many (${slot.max_students})` : '👤 1-to-1'}
            </Text>
          </View>
        </View>
        <Text style={s.slotDate}>
          📅 {new Date(slot.start_time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
        <Text style={s.slotTime}>
          ⏰ {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' – '}
          {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {slot.batch_label && (
          <Text style={s.batchTag}>🔁 {slot.batch_label}</Text>
        )}
        <Text style={[s.slotStatus, slot.is_booked ? s.statusBooked : s.statusAvailable]}>
          {slot.is_booked ? '● Booked' : '● Available'}
        </Text>
      </View>
      {!slot.is_booked && (
        <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteSlot(slot.id)}>
          <Text style={s.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.isSelected === nextProps.isSelected && prevProps.slot === nextProps.slot;
});

const ManageAvailability = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);

  // Session Type
  const [sessionType, setSessionType] = useState<'ONE_TO_ONE' | 'ONE_TO_MANY'>('ONE_TO_ONE');
  const [maxStudents, setMaxStudents] = useState('5');

  // Subject
  const [tutorSubjects, setTutorSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  // Recurrence
  const [recurrence, setRecurrence] = useState<'NONE' | 'WEEKLY' | 'MONTHLY'>('NONE');
  // Days of week: 0=Mon … 6=Sun
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  // Monthly: end date
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 30 * 24 * 3600 * 1000));
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Date & Time pickers
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState<{start: Date, end: Date}[]>([{ start: new Date(), end: new Date(Date.now() + 3600 * 1000) }]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [targetField, setTargetField] = useState<'date' | 'start' | 'end'>('date');
  const [targetIndex, setTargetIndex] = useState(0);

  const maxStudentsScrollerRef = useRef<ScrollView>(null);
  const WHEEL_ITEM_HEIGHT = 32;
  const maxStudentsData = Array.from({ length: 49 }, (_, i) => String(i + 2));

  const [verificationStatus, setVerificationStatus] = useState<string>('APPROVED');

  const fetchSlots = () => {
    setLoading(true);
    apiClient.get('schedule-slots/')
      .then(res => setSlots(res.data))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  };

  const fetchProfile = () => {
    apiClient.get('profile/me/')
      .then(res => {
        if (res.data.verification_status) {
          setVerificationStatus(res.data.verification_status);
          if (res.data.verification_status !== 'APPROVED') {
            Alert.alert(
              'Admin Approval Pending ⏳',
              'Your profile is currently under review by our admin team. You cannot add class schedules until your account is approved.'
            );
          }
        }
        if (res.data.subjects) {
          setTutorSubjects(res.data.subjects);
          if (res.data.subjects.length > 0 && !selectedSubjectId) {
            setSelectedSubjectId(res.data.subjects[0].id);
          }
        }
      })
      .catch(() => {});
  };

  useFocusEffect(useCallback(() => {
    fetchSlots();
    fetchProfile();
  }, []));

  const openPicker = (mode: 'date' | 'time', target: 'date' | 'start' | 'end', index: number = 0) => {
    setPickerMode(mode);
    setTargetField(target);
    setTargetIndex(index);
    setShowPicker(true);
  };

  const addTimeSlot = () => {
    setTimeSlots(prev => [...prev, { start: new Date(), end: new Date(Date.now() + 3600 * 1000) }]);
  };

  const removeTimeSlot = (index: number) => {
    setTimeSlots(prev => prev.filter((_, i) => i !== index));
  };

  const onPickerChange = (event: any, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) {
      if (targetField === 'date') setSelectedDate(date);
      if (targetField === 'start') {
        setTimeSlots(prev => prev.map((ts, i) => i === targetIndex ? { ...ts, start: date } : ts));
      }
      if (targetField === 'end') {
        setTimeSlots(prev => prev.map((ts, i) => i === targetIndex ? { ...ts, end: date } : ts));
      }
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddSlot = () => {
    if (verificationStatus !== 'APPROVED') {
      Alert.alert(
        'Admin Approval Pending ⏳',
        'Your profile is currently under review by our admin team. You cannot add class schedules until your account is approved by the admin.'
      );
      return;
    }

    const formattedTimeSlots = timeSlots.map(ts => {
      const s = new Date(selectedDate);
      s.setHours(ts.start.getHours(), ts.start.getMinutes(), 0, 0);
      const e = new Date(selectedDate);
      e.setHours(ts.end.getHours(), ts.end.getMinutes(), 0, 0);
      return { start_time: s.toISOString(), end_time: e.toISOString(), start_obj: s, end_obj: e };
    });

    for (const ts of formattedTimeSlots) {
      if (ts.start_obj <= new Date()) {
        Alert.alert('Error', 'Please select a future time.');
        return;
      }
      if (ts.end_obj <= ts.start_obj) {
        Alert.alert('Error', 'End time must be after start time.');
        return;
      }
    }
    if (!selectedSubjectId) {
      Alert.alert('Error', 'Please select a subject.');
      return;
    }
    if (recurrence !== 'NONE' && selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day of the week.');
      return;
    }

    const payload: any = {
      time_slots: formattedTimeSlots.map(ts => ({ start_time: ts.start_time, end_time: ts.end_time })),
      subject_id: selectedSubjectId,
      recurrence_type: recurrence,
      days_of_week: selectedDays,
      session_type: sessionType,
      max_students: sessionType === 'ONE_TO_MANY' ? parseInt(maxStudents) || 5 : 1,
    };

    if (recurrence === 'MONTHLY') {
      payload.end_date = endDate.toISOString().split('T')[0];
    }

    apiClient.post('schedule-slots/', payload)
      .then(res => {
        const count = Array.isArray(res.data) ? res.data.length : 1;
        Alert.alert('Success', `${count} time slot${count > 1 ? 's' : ''} added successfully!`);
        setSelectedDays([]);
        fetchSlots();
      })
      .catch((err) => {
        if (err.response?.data?.detail) {
          Alert.alert('Admin Approval Pending ⏳', err.response.data.detail);
        } else {
          Alert.alert('Error', 'Could not add time slot. Check your internet connection.');
        }
      });
  };

  const handleDeleteSlot = (id: number) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to remove this slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          apiClient.delete(`schedule-slots/${id}/`)
            .then(() => { Alert.alert('Removed', 'Time slot removed.'); fetchSlots(); })
            .catch(err => {
              Alert.alert('Error', err.response?.data?.detail || 'Could not remove time slot.');
            });
        }
      }
    ]);
  };

  const handleBulkDelete = () => {
    if (selectedSlots.length === 0) return;
    Alert.alert('Confirm Delete', `Are you sure you want to remove ${selectedSlots.length} selected slot(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          apiClient.post(`schedule-slots/bulk-delete/`, { slot_ids: selectedSlots })
            .then(res => {
              Alert.alert('Removed', res.data.detail || 'Time slots removed.');
              setSelectedSlots([]);
              fetchSlots();
            })
            .catch(err => {
              Alert.alert('Error', err.response?.data?.detail || 'Could not remove time slots.');
            });
        }
      }
    ]);
  };

  const unbookedSlots = slots.filter(s => !s.is_booked);
  const allSelected = unbookedSlots.length > 0 && selectedSlots.length === unbookedSlots.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedSlots([]);
    } else {
      setSelectedSlots(unbookedSlots.map(s => s.id));
    }
  };

  const toggleSlotSelection = (id: number) => {
    setSelectedSlots(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const s = createStyles(colors);

  const renderHeader = () => (
    <View>
      <Text style={s.subtitle}>
        Define your availability. Students book your exact slots on a first-come, first-serve basis.
      </Text>

      {verificationStatus !== 'APPROVED' && (
        <View style={s.pendingBanner}>
          <Text style={s.pendingBannerIcon}>⏳</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.pendingBannerTitle}>Admin Approval Pending</Text>
            <Text style={s.pendingBannerText}>
              Your profile is currently under review by our admin team. You cannot add class schedules until your account is approved.
            </Text>
          </View>
        </View>
      )}

      {/* ── ADD SLOT FORM ───────────────────────────────── */}
      <Text style={s.sectionTitle}>Add New Time Slot</Text>

      {/* Subject */}
      <Text style={s.label}>Subject</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
        {tutorSubjects.length === 0 ? (
          <Text style={s.emptyHint}>No subjects in your profile yet.</Text>
        ) : tutorSubjects.map(sub => (
          <TouchableOpacity
            key={sub.id}
            style={[s.chip, selectedSubjectId === sub.id && s.chipActive]}
            onPress={() => setSelectedSubjectId(sub.id)}
          >
            <Text style={[s.chipText, selectedSubjectId === sub.id && s.chipTextActive]}>
              {sub.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Session Mode */}
      <Text style={s.label}>Session Mode</Text>
      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, sessionType === 'ONE_TO_ONE' && s.toggleBtnActive]}
          onPress={() => setSessionType('ONE_TO_ONE')}
        >
          <Text style={[s.toggleBtnText, sessionType === 'ONE_TO_ONE' && s.toggleTextActive]}>👤 1-to-1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, sessionType === 'ONE_TO_MANY' && s.toggleBtnActive]}
          onPress={() => setSessionType('ONE_TO_MANY')}
        >
          <Text style={[s.toggleBtnText, sessionType === 'ONE_TO_MANY' && s.toggleTextActive]}>👥 1-to-Many</Text>
        </TouchableOpacity>
      </View>

      {sessionType === 'ONE_TO_MANY' && (
        <View style={{ marginBottom: spacing['3'] }}>
          <Text style={s.label}>Max Students per Session</Text>
          <View style={s.wheelContainer}>
            <View style={s.wheelSelectionBand} pointerEvents="none" />
            <ScrollView
              ref={maxStudentsScrollerRef}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              snapToInterval={WHEEL_ITEM_HEIGHT}
              decelerationRate="fast"
              contentOffset={{ x: 0, y: Math.max(0, (parseInt(maxStudents) - 2) * WHEEL_ITEM_HEIGHT) }}
              contentContainerStyle={{ paddingVertical: WHEEL_ITEM_HEIGHT }}
              onMomentumScrollEnd={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                const index = Math.round(y / WHEEL_ITEM_HEIGHT);
                if (index < 0 || index >= maxStudentsData.length) return;
                
                const selectedVal = maxStudentsData[index];
                
                if (parseInt(selectedVal) > 10 && parseInt(maxStudents) <= 10) {
                  Alert.alert(
                    'Large Class Warning',
                    'Having more than 10 students in a class might lead to less efficient teaching and could affect the ratings of the tutor. Do you want to proceed?',
                    [
                      { 
                        text: 'Cancel', 
                        style: 'cancel', 
                        onPress: () => {
                          const prevVal = parseInt(maxStudents) > 10 ? '10' : maxStudents;
                          const targetIdx = maxStudentsData.indexOf(prevVal);
                          maxStudentsScrollerRef.current?.scrollTo({ y: Math.max(0, targetIdx * WHEEL_ITEM_HEIGHT), animated: true });
                          if (parseInt(maxStudents) > 10) setMaxStudents('10');
                        }
                      },
                      { 
                        text: 'Proceed', 
                        style: 'destructive', 
                        onPress: () => setMaxStudents(selectedVal) 
                      }
                    ]
                  );
                } else {
                  setMaxStudents(selectedVal);
                }
              }}
            >
              {maxStudentsData.map((num) => {
                const isSelected = maxStudents === num;
                return (
                  <View key={num} style={s.wheelItem}>
                    <Text style={[s.wheelItemText, isSelected && s.wheelItemTextActive]}>
                      {num}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Recurrence toggle */}
      <Text style={[s.label, { marginTop: spacing['3'] }]}>Schedule Type</Text>
      <View style={s.toggleRow}>
        {(['NONE', 'WEEKLY', 'MONTHLY'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[s.toggleBtn, recurrence === type && s.toggleBtnActive]}
            onPress={() => { setRecurrence(type); setSelectedDays([]); }}
          >
            <Text style={[s.toggleBtnText, recurrence === type && s.toggleTextActive]}>
              {type === 'NONE' ? '📌 Single' : type === 'WEEKLY' ? '📆 Weekly' : '🗓️ Monthly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Start Date */}
      <View style={s.pickerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Start Date</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => openPicker('date', 'date')}>
            <Text style={s.pickerText}>📅 {selectedDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day-of-week selector */}
      {recurrence !== 'NONE' && (
        <>
          <Text style={s.label}>Days of Week</Text>
          <View style={s.dayRow}>
            {DAY_LABELS.map((label, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.dayBtn, selectedDays.includes(idx) && s.dayBtnActive]}
                onPress={() => toggleDay(idx)}
              >
                <Text style={[s.dayBtnText, selectedDays.includes(idx) && s.dayBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* MONTHLY: end date picker */}
      {recurrence === 'MONTHLY' && (
        <View style={{ marginTop: spacing['3'] }}>
          <Text style={s.label}>End Date</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setShowEndDatePicker(true)}>
            <Text style={s.pickerText}>📅 Until: {endDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              minimumDate={new Date(selectedDate.getTime() + 24 * 3600 * 1000)}
              onChange={(_, d) => { setShowEndDatePicker(false); if (d) setEndDate(d); }}
            />
          )}
        </View>
      )}

      {/* Time pickers */}
      <View style={{ marginTop: spacing['3'] }}>
        <Text style={s.sectionTitle}>Time Slots</Text>
        {timeSlots.map((ts, index) => (
          <View key={index} style={[s.pickerRow, { alignItems: 'flex-end', marginBottom: spacing['3'] }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Start Time</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => openPicker('time', 'start', index)}>
                <Text style={s.pickerText}>⏰ {ts.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>End Time</Text>
              <TouchableOpacity style={s.pickerBtn} onPress={() => openPicker('time', 'end', index)}>
                <Text style={s.pickerText}>⏰ {ts.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>
            {timeSlots.length > 1 && (
              <TouchableOpacity style={s.deleteBtn} onPress={() => removeTimeSlot(index)}>
                <Text style={s.deleteBtnText}>❌</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={[s.pickerBtn, { marginTop: spacing['2'], backgroundColor: colors.surface }]} onPress={addTimeSlot}>
          <Text style={[s.pickerText, { color: colors.primary }]}>+ Add Another Time Slot</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={targetField === 'date' ? selectedDate : targetField === 'start' ? timeSlots[targetIndex].start : timeSlots[targetIndex].end}
          mode={pickerMode}
          is24Hour={false}
          display="default"
          onChange={onPickerChange}
          minimumDate={targetField === 'date' ? new Date() : undefined}
        />
      )}

      {/* Preview label */}
      {recurrence !== 'NONE' && selectedDays.length > 0 && (
        <View style={s.previewBox}>
          <Text style={s.previewText}>
            {recurrence === 'WEEKLY'
              ? `📆 ${selectedDays.sort().map(d => DAY_LABELS[d]).join(', ')} (Auto calculated duration)`
              : `🗓️ ${selectedDays.sort().map(d => DAY_LABELS[d]).join(', ')} until ${endDate.toLocaleDateString()}`
            }
          </Text>
        </View>
      )}

      <TouchableOpacity style={s.scheduleBtn} onPress={handleAddSlot} activeOpacity={0.85}>
        <Text style={s.scheduleBtnText}>+ Add Time Slot</Text>
      </TouchableOpacity>

      {/* ── SCHEDULE LIST HEADER ──────────────────────────────── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['8'], marginBottom: spacing['3'] }}>
        <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Your Schedule</Text>
        {unbookedSlots.length > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing['3'] }}>
            <TouchableOpacity onPress={toggleSelectAll} style={s.selectAllBtn}>
              <Text style={s.selectAllBtnText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
            {selectedSlots.length > 0 && (
              <TouchableOpacity onPress={handleBulkDelete} style={s.bulkDeleteBtn}>
                <Text style={s.bulkDeleteBtnText}>Delete ({selectedSlots.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Manage Schedule</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={slots}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={<View style={{ height: spacing['5'] }} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['6'] }} />
          ) : (
            <View style={s.noDataBox}>
              <Text style={s.noDataText}>No time slots scheduled yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <SlotCardView
            slot={item}
            isSelected={selectedSlots.includes(item.id)}
            s={s}
            toggleSlotSelection={toggleSlotSelection}
            handleDeleteSlot={handleDeleteSlot}
            spacing={spacing}
          />
        )}
      />
    </View>
  );
};
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

  container: { padding: spacing['5'], paddingBottom: spacing['10'] },
  subtitle: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginBottom: spacing['5'], lineHeight: typography.lineHeight.relaxed,
  },
  sectionTitle: {
    fontSize: typography.size.md, fontWeight: typography.weight.bold,
    color: colors.text, marginBottom: spacing['3'], marginTop: spacing['2'],
  },

  pickerRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['1'] },
  label: { fontSize: typography.size.xs, color: colors.textSecondary, marginBottom: spacing['2'], marginLeft: 2, fontWeight: typography.weight.semibold },
  pickerBtn: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
    padding: spacing['4'], borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  pickerText: { fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.semibold },

  // Subject chips
  chipsScroll: { marginVertical: spacing['2'] },
  chip: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: spacing['4'], paddingVertical: spacing['2'],
    backgroundColor: colors.surface, marginRight: spacing['2'],
  },
  chipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  chipTextActive: { color: colors.primary },
  emptyHint: { color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm, paddingVertical: spacing['2'] },

  // Recurrence toggle
  toggleRow: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['1'], marginBottom: spacing['3'] },
  toggleBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing['3'], alignItems: 'center', backgroundColor: colors.surface,
  },
  toggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  toggleBtnText: { color: colors.textSecondary, fontWeight: typography.weight.bold, fontSize: typography.size.xs },
  toggleTextActive: { color: colors.primary },

  // Day selector
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginBottom: spacing['3'], marginTop: spacing['1'] },
  dayBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: spacing['3'], paddingVertical: spacing['2'],
    backgroundColor: colors.surface, minWidth: 44, alignItems: 'center',
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnText: { color: colors.textSecondary, fontWeight: typography.weight.bold, fontSize: typography.size.xs },
  dayBtnTextActive: { color: colors.white },

  // Inputs
  inputWrapper: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, marginTop: spacing['1'],
  },
  textInput: {
    color: colors.text, padding: spacing['3'], fontSize: typography.size.base,
  },

  // Preview
  previewBox: {
    backgroundColor: colors.primary + '10', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary + '30',
    padding: spacing['3'], marginVertical: spacing['2'],
  },
  previewText: { color: colors.primary, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },

  // Submit button
  scheduleBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['3'],
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  scheduleBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  noDataBox: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['5'], alignItems: 'center', borderWidth: 1, borderColor: colors.glassBorder,
  },
  noDataText: { color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm },

  slotList: { gap: spacing['3'], marginBottom: spacing['4'] },
  slotCard: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    padding: spacing['4'], flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  slotSubject: { color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.sm, marginBottom: 2 },
  slotDate: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text },
  slotTime: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 2 },
  batchTag: { fontSize: typography.size.xs, color: colors.warning, fontWeight: typography.weight.bold, marginTop: 4 },
  slotStatus: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, marginTop: spacing['2'] },
  statusBooked: { color: colors.error },
  statusAvailable: { color: colors.success },
  deleteBtn: {
    padding: spacing['2'], backgroundColor: colors.errorBg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.error + '40',
  },
  deleteBtnText: { color: colors.error, fontSize: typography.size.xs, fontWeight: typography.weight.bold },

  sessionBadge: {
    borderRadius: radius.full, paddingHorizontal: spacing['2'], paddingVertical: 2,
    borderWidth: 1,
  },
  oneBadge: { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' },
  manyBadge: { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' },
  sessionBadgeText: { fontSize: 10, fontWeight: typography.weight.bold, color: colors.text },

  selectAllBtn: { paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  selectAllBtnText: { color: colors.textSecondary, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  bulkDeleteBtn: { paddingVertical: spacing['2'], paddingHorizontal: spacing['3'], backgroundColor: colors.errorBg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error + '40' },
  bulkDeleteBtnText: { color: colors.error, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  
  slotCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxIcon: { color: colors.white, fontSize: 14, fontWeight: 'bold' },

  wheelContainer: {
    height: 96, // 32 * 3
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
    width: 100, // Make it narrower
  },
  wheelSelectionBand: {
    position: 'absolute',
    top: 32, // ITEM_HEIGHT
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: colors.primary + '15',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.primary + '40',
    zIndex: 1,
  },
  wheelItem: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  wheelItemText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  wheelItemTextActive: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    borderWidth: 1,
    borderColor: colors.warning + '40',
    borderRadius: radius.lg,
    padding: spacing['4'],
    marginBottom: spacing['4'],
    gap: spacing['3'],
  },
  pendingBannerIcon: { fontSize: 24 },
  pendingBannerTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.warning,
    marginBottom: 2,
  },
  pendingBannerText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

export default ManageAvailability;
