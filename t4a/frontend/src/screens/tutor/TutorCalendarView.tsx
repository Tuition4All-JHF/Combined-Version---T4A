import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Calendar } from 'react-native-big-calendar';
import dayjs from 'dayjs';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

type ViewMode = 'day' | '3days' | 'week' | 'month';

interface ScheduleSlot {
  id: number;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  subject_name?: string;
  session_type?: 'ONE_TO_ONE' | 'ONE_TO_MANY';
  max_students?: number;
}

const TutorCalendarView = ({ navigation }: any) => {
  const { colors, isDark } = useTheme();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('day'); // Default to 'day' as scrollable
  const [currentDate, setCurrentDate] = useState(new Date());

  useFocusEffect(useCallback(() => {
    fetchSlots();
  }, []));

  const fetchSlots = (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    apiClient.get('schedule-slots/')
      .then(res => setSlots(res.data))
      .catch(() => setSlots([]))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  const events = useMemo(() => {
    // Sort slots by start_time
    const sortedSlots = [...slots].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const timeCount: { [key: string]: number } = {};

    return sortedSlots.map(slot => {
      let start = new Date(slot.start_time);
      let end = new Date(slot.end_time);
      const timeKey = start.toISOString();

      if (timeCount[timeKey] === undefined) {
        timeCount[timeKey] = 0;
      } else {
        timeCount[timeKey] += 1;
        // Shift start time by 1 minute for each duplicate to force side-by-side rendering
        start = new Date(start.getTime() + timeCount[timeKey] * 60 * 1000);
      }

      return {
        title: `${slot.session_type === 'ONE_TO_MANY' ? '👥' : '👤'} ${slot.subject_name || 'Slot'}\n${slot.is_booked ? '(Booked)' : '(Available)'}`,
        start,
        end,
        color: slot.is_booked ? colors.error : colors.success,
        slotData: slot,
      };
    });
  }, [slots, colors]);
  const handlePrev = () => {
    setCurrentDate(prev => {
      const d = dayjs(prev);
      if (viewMode === 'day') return d.subtract(1, 'day').toDate();
      if (viewMode === '3days') return d.subtract(3, 'day').toDate();
      if (viewMode === 'week') return d.subtract(1, 'week').toDate();
      return d.subtract(1, 'month').toDate();
    });
  };

  const handleNext = () => {
    setCurrentDate(prev => {
      const d = dayjs(prev);
      if (viewMode === 'day') return d.add(1, 'day').toDate();
      if (viewMode === '3days') return d.add(3, 'day').toDate();
      if (viewMode === 'week') return d.add(1, 'week').toDate();
      return d.add(1, 'month').toDate();
    });
  };

  const navLabel = useMemo(() => {
    const d = dayjs(currentDate);
    if (viewMode === 'day') {
      return d.format('MMMM D, YYYY');
    }
    if (viewMode === '3days') {
      const end = d.add(2, 'day');
      if (d.month() === end.month()) {
        return `${d.format('MMMM D')} – ${end.format('D, YYYY')}`;
      }
      return `${d.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
    }
    if (viewMode === 'week') {
      const start = d.startOf('week');
      const end = d.endOf('week');
      if (start.month() === end.month()) {
        return `${start.format('MMMM D')} – ${end.format('D, YYYY')}`;
      }
      return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
    }
    return d.format('MMMM YYYY');
  }, [currentDate, viewMode]);

  const s = createStyles(colors);

  const renderEvent = (event: any, touchableOpacityProps: any) => {
    const { slotData } = event;
    const isBooked = slotData.is_booked;
    const { key, ...otherProps } = touchableOpacityProps;
    const eventColor = isBooked ? colors.error : colors.success;
    const isMonth = viewMode === 'month';
    
    return (
      <TouchableOpacity
        key={key}
        {...otherProps}
        style={[
          otherProps.style,
          s.eventCard,
          isMonth ? s.eventCardMonth : null,
          { backgroundColor: isBooked ? colors.error + '15' : colors.success + '15' },
          { borderColor: eventColor }
        ]}
      >
        <Text style={[isMonth ? s.eventTextMonth : s.eventText, { color: eventColor }]} numberOfLines={1}>
          {slotData.session_type === 'ONE_TO_MANY' ? '👥' : '👤'} {slotData.subject_name || 'Slot'}
        </Text>
        {!isMonth && (
          <Text style={[s.eventSubtext, { color: eventColor }]} numberOfLines={1}>
            {isBooked ? 'Booked' : 'Available'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* View Mode Toggle */}
      <View style={s.toggleContainer}>
        {(['day', '3days', 'week', 'month'] as ViewMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[s.toggleBtn, viewMode === mode && s.toggleBtnActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[s.toggleText, viewMode === mode && s.toggleTextActive]}>
              {mode === 'day' ? 'Day' : mode === '3days' ? '3 Days' : mode === 'week' ? 'Week' : 'Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Navigation Bar */}
      <View style={s.navContainer}>
        <TouchableOpacity 
          style={s.todayBtn} 
          onPress={() => setCurrentDate(new Date())}
        >
          <Text style={s.todayText}>Today</Text>
        </TouchableOpacity>
        
        <View style={s.arrowsContainer}>
          <TouchableOpacity style={s.arrowBtn} onPress={handlePrev}>
            <Text style={s.arrowText}>‹</Text>
          </TouchableOpacity>
          
          <Text style={s.navLabel}>{navLabel}</Text>
          
          <TouchableOpacity style={s.arrowBtn} onPress={handleNext}>
            <Text style={s.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar Area */}
      <ScrollView
        style={s.calendarWrapper}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSlots(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {loading && slots.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['6'] }} size="large" />
        ) : (
          <Calendar
            events={events}
            height={600}
            mode={viewMode}
            date={currentDate}
            onChangeDate={(dates: [Date, Date]) => {
              if (dates && dates[0] && !dayjs(dates[0]).isSame(currentDate, 'day')) {
                setCurrentDate(dates[0]);
              }
            }}
            renderEvent={renderEvent}
            hideNowIndicator={true}
            theme={{
              palette: {
                primary: {
                  main: colors.primary,
                  contrastText: colors.white,
                },
              },
            } as any}
          />
        )}
      </ScrollView>
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
  
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['3'],
    backgroundColor: colors.surfaceElevated,
    gap: spacing['2'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing['2'],
    alignItems: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  
  calendarWrapper: {
    flex: 1,
  },
  
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'] + 2,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  todayBtn: {
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'] + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  arrowsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 20,
    fontWeight: typography.weight.bold,
    color: colors.text,
    lineHeight: 22,
  },
  navLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
    minWidth: 120,
    textAlign: 'center',
  },
  
  eventCard: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minHeight: 48,
    justifyContent: 'center',
  },
  eventCardMonth: {
    minHeight: 16,
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 3,
    borderWidth: 1,
  },
  eventText: {
    fontSize: 9,
    fontWeight: 'bold',
    lineHeight: 11,
  },
  eventTextMonth: {
    fontSize: 7,
    fontWeight: '600',
    lineHeight: 9,
  },
  eventSubtext: {
    fontSize: 8,
    marginTop: 1,
  }
});

export default TutorCalendarView;
