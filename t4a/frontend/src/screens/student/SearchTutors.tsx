import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Image, StatusBar,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';

interface SubjectDetail { id: number; name: string; hourly_rate: string; course_duration_hours: number; }
interface Tutor {
  id: number; user_id: number; username: string; first_name?: string; last_name?: string; bio: string;
  qualifications: string; rating: string;
  experience_years: number; subjects: SubjectDetail[]; profile_photo?: string | null;
}

const SearchTutors = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [searchText, setSearchText] = useState('');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'ALL' | 'ONE_TO_ONE' | 'ONE_TO_MANY'>('ALL');
  const [maxRate, setMaxRate] = useState(3000);
  const scrollViewRef = useRef<ScrollView>(null);
  const resultsLayoutY = useRef<number>(0);

  useEffect(() => {
    apiClient.get('subjects/').then(res => setSubjects(res.data)).catch(() => {});
  }, []);

  const handleSearch = () => {
    setLoading(true);
    setSearched(true);
    const params: any = {};
    if (selectedSubject) params['subjects__id'] = selectedSubject.id;
    if (searchText) params['search'] = searchText;
    if (sessionTypeFilter !== 'ALL') params['session_type'] = sessionTypeFilter;
    if (maxRate) params['max_rate'] = maxRate;

    apiClient.get('tutors/', { params })
      .then(res => {
        setTutors(res.data);
      })
      .catch(() => setTutors([]))
      .finally(() => setLoading(false));
  };

  const s = createStyles(colors);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Find a Tutor</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={s.body} 
        showsVerticalScrollIndicator={false}
      >
        {/* Search Controls */}
        <View style={s.searchBox}>
          <View style={[s.searchInputWrapper, searchFocused && s.searchInputFocused]}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search by name or keyword..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </View>

          {/* Subject Dropdown */}
          <Text style={s.filterLabel}>Subject Category</Text>
          <TouchableOpacity 
            style={s.dropdownBtn} 
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <Text style={s.dropdownBtnText}>
              {selectedSubject ? selectedSubject.name : 'All Subjects'}
            </Text>
            <Text style={s.dropdownIcon}>{isDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {isDropdownOpen && (
            <ScrollView style={s.dropdownMenu} nestedScrollEnabled={true}>
              <TouchableOpacity 
                style={[s.dropdownItem, !selectedSubject && s.dropdownItemActive]} 
                onPress={() => { setSelectedSubject(null); setIsDropdownOpen(false); }}
              >
                <Text style={[s.dropdownItemText, !selectedSubject && s.dropdownItemTextActive]}>All Subjects</Text>
              </TouchableOpacity>
              {subjects.map(subj => (
                <TouchableOpacity
                  key={subj.id}
                  style={[s.dropdownItem, selectedSubject?.id === subj.id && s.dropdownItemActive]}
                  onPress={() => { setSelectedSubject(subj); setIsDropdownOpen(false); }}
                >
                  <Text style={[s.dropdownItemText, selectedSubject?.id === subj.id && s.dropdownItemTextActive]}>
                    {subj.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
            <Text style={s.searchBtnText}>Search Tutors</Text>
          </TouchableOpacity>

          {/* Max Hourly Rate Filter */}
          <View style={s.filterHeaderRow}>
            <Text style={s.filterLabel}>Max Hourly Rate</Text>
            <Text style={s.rateValueText}>₹{maxRate}/hr</Text>
          </View>
          <View style={s.sliderContainer}>
            <Text style={s.sliderBound}>₹100</Text>
            <Slider
              style={s.slider}
              minimumValue={100}
              maximumValue={3000}
              step={100}
              value={maxRate}
              onValueChange={setMaxRate}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <Text style={s.sliderBound}>₹3000</Text>
          </View>

          {/* Session Type Filter */}
          <Text style={s.filterLabel}>Session Type</Text>
          <View style={s.sessionFilterRow}>
            {([['ALL', '🔀 All'], ['ONE_TO_ONE', '👤 1-to-1'], ['ONE_TO_MANY', '👥 1-to-Many']] as const).map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[s.sessionFilterBtn, sessionTypeFilter === val && s.sessionFilterBtnActive]}
                onPress={() => setSessionTypeFilter(val)}
              >
                <Text style={[s.sessionFilterText, sessionTypeFilter === val && s.sessionFilterTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Results */}
        <View 
          style={{ paddingBottom: spacing['6'] }}
          onLayout={(e) => { resultsLayoutY.current = e.nativeEvent.layout.y; }}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
          ) : searched && tutors.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>😕</Text>
              <Text style={s.emptyTitle}>No tutors found</Text>
              <Text style={s.emptyText}>Try a different subject or search term.</Text>
            </View>
          ) : (
            tutors.map(tutor => (
              <TouchableOpacity
                key={tutor.id}
                style={s.card}
                onPress={() => navigation.navigate('TutorPublicProfile', { tutor })}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={s.avatar}>
                    {tutor.profile_photo ? (
                      <Image source={{ uri: tutor.profile_photo }} style={s.avatarImage} />
                    ) : (
                      <Text style={s.avatarText}>{(tutor.first_name || tutor.username || 'U')[0].toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.tutorName}>{tutor.first_name ? `${tutor.first_name} ${tutor.last_name || ''}`.trim() : tutor.username}</Text>
                    <View style={s.ratingRow}>
                      <Text style={s.starIcon}>⭐</Text>
                      <Text style={s.tutorRating}>{tutor.rating || '—'}</Text>
                      {tutor.experience_years ? (
                        <Text style={s.expText}>· {tutor.experience_years} yrs</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={s.rateBox}>
                    {selectedSubject && tutor.subjects?.find(s => s.id === selectedSubject.id) ? (
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={s.rate}>₹{(Number(tutor.subjects.find(s => s.id === selectedSubject.id)?.hourly_rate) || 0) * (Number(tutor.subjects.find(s => s.id === selectedSubject.id)?.course_duration_hours) || 0)}</Text>
                        <Text style={s.rateLabel}>Total Fee ({tutor.subjects.find(s => s.id === selectedSubject.id)?.course_duration_hours || 0} hrs)</Text>
                      </View>
                    ) : (
                      <Text style={s.rateLabel}>Rates vary</Text>
                    )}
                  </View>
                </View>

                {tutor.qualifications ? (
                  <Text style={s.qualification} numberOfLines={1}>
                    🎓 {tutor.qualifications}
                  </Text>
                ) : null}
                {tutor.bio ? (
                  <Text style={s.bio} numberOfLines={2}>{tutor.bio}</Text>
                ) : null}

                <View style={s.subjectRow}>
                  {tutor.subjects?.map((subj: any, i: number) => {
                    const fee = (Number(subj.hourly_rate) || 0) * (Number(subj.course_duration_hours) || 0);
                    const duration = Number(subj.course_duration_hours) || 0;
                    return (
                      <View key={i} style={s.subjectTag}>
                        <Text style={s.subjectTagText}>{subj.name} • ₹{fee} ({duration}h)</Text>
                      </View>
                    );
                  })}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },

  body: { flex: 1 },

  searchBox: {
    backgroundColor: colors.surface,
    padding: spacing['4'],
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing['3'],
    marginBottom: spacing['3'],
  },
  searchInputFocused: {
    borderColor: colors.primary,
  },
  searchIcon: { fontSize: 16, marginRight: spacing['2'] },
  searchInput: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.text,
    paddingVertical: spacing['3'],
  },
  
  // Dropdown styles added to replace chips
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['3'],
    marginBottom: spacing['3'],
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dropdownBtnText: {
    color: colors.text,
    fontSize: typography.size.base,
  },
  dropdownIcon: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
  },
  dropdownMenu: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: -8,
    marginBottom: spacing['3'],
    maxHeight: 200,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownItem: {
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dropdownItemActive: {
    backgroundColor: colors.primary + '18',
  },
  dropdownItemText: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.bold,
  },

  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing['3'] + 2,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  searchBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['2'], textAlign: 'center' },

  card: {
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: spacing['4'],
    marginTop: spacing['3'],
    borderRadius: radius.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'] },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing['3'],
    borderWidth: 2,
    borderColor: colors.primary + '60',
  },
  avatarImage: { width: 52, height: 52, borderRadius: radius.full },
  avatarText: { color: colors.primary, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
  cardInfo: { flex: 1 },
  tutorName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  starIcon: { fontSize: 12, marginRight: 3 },
  tutorRating: { fontSize: typography.size.sm, color: colors.textSecondary },
  expText: { fontSize: typography.size.sm, color: colors.textMuted, marginLeft: 4 },
  rateBox: { alignItems: 'flex-end' },
  rate: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.primary },
  rateLabel: { fontSize: typography.size.xs, color: colors.textMuted },
  qualification: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['2'] },
  bio: { fontSize: typography.size.sm, color: colors.text, lineHeight: typography.lineHeight.normal, marginBottom: spacing['3'] },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] },
  subjectTag: {
    backgroundColor: colors.primary + '18',
    borderRadius: radius.full,
    paddingHorizontal: spacing['3'],
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  subjectTagText: { color: colors.primary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  filterLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.bold,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: spacing['3'], marginBottom: spacing['2'],
  },
  filterHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing['3'], marginBottom: spacing['2'],
  },
  rateValueText: {
    fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.primary,
  },
  sliderContainer: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'],
  },
  slider: {
    flex: 1, marginHorizontal: spacing['2'], height: 40,
  },
  sliderBound: {
    fontSize: typography.size.xs, color: colors.textMuted,
  },
  sessionFilterRow: { flexDirection: 'row', gap: spacing['2'] },
  sessionFilterBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing['2'], alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  sessionFilterBtnActive: {
    borderColor: colors.primary, backgroundColor: colors.primary + '18',
  },
  sessionFilterText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.textSecondary },
  sessionFilterTextActive: { color: colors.primary },
});

export default SearchTutors;
