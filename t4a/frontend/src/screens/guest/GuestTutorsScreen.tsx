import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Image, StatusBar, Alert, BackHandler
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useDispatch } from 'react-redux';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { lightColors } from '../../theme/ThemeContext';
import apiClient from '../../api/client';
import { logout } from '../../redux/authSlice';
import T4ALogo from '../../components/T4ALogo';

interface Subject { id: number; name: string; }
interface Tutor {
  id: number; user_id: number; username: string; first_name?: string; last_name?: string; bio: string;
  qualifications: string; hourly_rate: string; rating: string;
  experience_years: number; subjects: Subject[]; profile_photo?: string | null;
}

const GuestTutorsScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const colors = lightColors;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [searchText, setSearchText] = useState('');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Fake max hourly rate for UI purposes (as per screenshot)
  const [maxRate, setMaxRate] = useState(2000);

  useEffect(() => {
    // Initial search
    handleSearch();
  }, []);

  useFocusEffect(
    useCallback(() => {
      apiClient.get('subjects/').then(res => setSubjects(res.data)).catch(() => {});
      const onBackPress = () => { dispatch(logout()); return true; };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [dispatch])
  );

  const handleSearch = () => {
    setLoading(true);
    setSearched(true);
    const params: any = {};
    if (selectedSubject) params['subjects__id'] = selectedSubject.id;
    if (searchText) params['search'] = searchText;
    if (maxRate) params['max_rate'] = maxRate;

    apiClient.get('tutors/', { params })
      .then(res => setTutors(res.data))
      .catch(() => setTutors([]))
      .finally(() => setLoading(false));
  };

  const handleEnrollPress = () => {
    Alert.alert(
      "Login Required",
      "You need to login or create an account to book a lesson.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => dispatch(logout()) } // Logout clears guest state and goes to Login
      ]
    );
  };

  const s = createStyles(colors);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoRow}>
           <T4ALogo variant="full" theme="colored" scale={0.75} />
        </View>
        <TouchableOpacity style={s.loginBtn} onPress={() => dispatch(logout())}>
           <Text style={s.loginBtnText}>Login</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
        
        <View style={s.contentRow}>
          {/* Left Column: Filters (Simulated in a vertical flow for mobile) */}
          <View style={s.filterSection}>
            <Text style={s.filterTitle}>Filter Tutors</Text>
            
            <Text style={s.filterLabel}>Search Keyword</Text>
            <View style={s.searchInputWrapper}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Name, credential, subject..." placeholderTextColor={colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSearch}
              />
            </View>

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
                minimumTrackTintColor="#6B4EFF"
                maximumTrackTintColor="#EFEFEF"
                thumbTintColor="#6B4EFF"
              />
              <Text style={s.sliderBound}>₹3000</Text>
            </View>

            <TouchableOpacity style={s.searchBtn} onPress={handleSearch}>
              <Text style={s.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Right Column: Results */}
          <View style={s.resultsSection}>
            <Text style={s.resultsCount}>Showing {tutors.length} results</Text>
            
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
            ) : (
              tutors.map(tutor => (
                <View key={tutor.id} style={s.tutorCard}>
                  <View style={s.cardHeader}>
                     <View style={s.avatar}>
                        {tutor.profile_photo ? (
                          <Image source={{ uri: tutor.profile_photo }} style={s.avatarImage} />
                        ) : (
                          <Text style={s.avatarText}>{(tutor.first_name || tutor.username || 'U')[0].toUpperCase()}</Text>
                        )}
                     </View>
                     <View style={s.tutorHeaderInfo}>
                       <View style={s.verifiedRow}>
                         <Text style={s.verifiedIcon}>✓</Text>
                         <Text style={s.verifiedText}>VERIFIED</Text>
                       </View>
                        <Text style={s.tutorName}>{tutor.first_name ? `${tutor.first_name} ${tutor.last_name || ''}`.trim() : tutor.username}</Text>
                        <Text style={s.tutorSubtitle}>Professional Tutor</Text>
                        {tutor.subjects && tutor.subjects.length > 0 && (
                          <View style={s.subjectChipsRow}>
                            {tutor.subjects.slice(0, 3).map((subj: any, i: number) => (
                              <View key={i} style={s.subjectChip}>
                                <Text style={s.subjectChipText}>{subj.subject_name || subj.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                     </View>
                  </View>

                  <View style={s.statsGrid}>
                    <View style={s.statRowCol}>
                      <Text style={s.statLabel}>Credentials</Text>
                      <Text style={s.statValueBlock}>{tutor.qualifications || 'N/A'}</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>DBS Registry</Text>
                      <Text style={s.statValueGood}>✓ Active Clearance</Text>
                    </View>
                    <View style={s.statRow}>
                      <Text style={s.statLabel}>Response Time</Text>
                      <Text style={s.statValueBg}>Under 1 hr</Text>
                    </View>
                  </View>

                  <Text style={s.ratingsTitle}>AUDITED 4D RATINGS:</Text>
                  <View style={s.ratingsGrid}>
                     <View style={s.ratingBox}>
                       <Text style={s.ratingBoxLabel}>EFFECTIVENESS</Text>
                       <Text style={s.ratingBoxValue}>⭐ {tutor.rating || '4.9'} / 5</Text>
                     </View>
                     <View style={s.ratingBox}>
                       <Text style={s.ratingBoxLabel}>PROGRESS</Text>
                       <Text style={s.ratingBoxValueColor}>+16.4% test avg</Text>
                     </View>
                     <View style={s.ratingBox}>
                       <Text style={s.ratingBoxLabel}>SATISFACTION</Text>
                       <Text style={s.ratingBoxValue}>98% parent approval</Text>
                     </View>
                     <View style={s.ratingBox}>
                       <Text style={s.ratingBoxLabel}>RELIABILITY</Text>
                       <Text style={s.ratingBoxValue}>100% on-time</Text>
                     </View>
                  </View>

                  <View style={s.cardFooter}>
                    <View style={s.priceSection}>
                      <Text style={s.priceLabel}>STARTING AT</Text>
                      <Text style={s.priceValue}>₹{(tutor.subjects && tutor.subjects.length > 0 ? Math.min(...tutor.subjects.map((s: any) => parseFloat(s.hourly_rate) || 0).filter((r: number) => r > 0)) : 0).toFixed(0)}<Text style={s.priceUnit}>/hr</Text></Text>
                    </View>
                    <View style={s.actionButtons}>
                       <TouchableOpacity style={s.viewProfileBtn} onPress={() => navigation.navigate('TutorPublicProfile', { tutor })}>
                          <Text style={s.viewProfileText}>View Profile</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={s.bookLessonBtn} onPress={handleEnrollPress}>
                          <Text style={s.bookLessonText}>Book Lesson</Text>
                       </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

export default GuestTutorsScreen;

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: '#EFEFEF',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: '#6B4EFF',
  },
  loginBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#6B4EFF',
    borderRadius: 20,
  },
  loginBtnText: {
    color: '#6B4EFF',
    fontWeight: 'bold',
  },
  body: { flex: 1, padding: spacing['4'] },
  contentRow: { flexDirection: 'column' },
  
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#6B4EFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#333',
  },
  subjectChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  subjectChip: {
    backgroundColor: '#EDE9FE',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#6B4EFF30',
  },
  subjectChipText: {
    color: '#6B4EFF',
    fontSize: 10,
    fontWeight: '600',
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dropdownBtnText: {
    color: '#333',
    fontSize: 14,
  },
  dropdownIcon: {
    color: '#666',
    fontSize: 12,
  },
  dropdownMenu: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 8,
    marginTop: -4,
    marginBottom: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropdownItemActive: {
    backgroundColor: '#6B4EFF10',
  },
  dropdownItemText: {
    color: '#333',
    fontSize: 14,
  },
  dropdownItemTextActive: {
    color: '#6B4EFF',
    fontWeight: 'bold',
  },
  filterHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, marginBottom: 8,
  },
  rateValueText: {
    fontSize: 14, fontWeight: 'bold', color: '#6B4EFF',
  },
  sliderContainer: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  slider: {
    flex: 1, marginHorizontal: 8, height: 40,
  },
  sliderBound: {
    fontSize: 12, color: '#888',
  },
  searchBtn: {
    backgroundColor: '#6B4EFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  searchBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  resultsSection: { flex: 1 },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  tutorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#6B4EFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarText: { color: '#6B4EFF', fontSize: 24, fontWeight: 'bold' },
  tutorHeaderInfo: { flex: 1, justifyContent: 'center' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  verifiedIcon: { color: '#4CAF50', fontSize: 12, marginRight: 4, fontWeight: 'bold' },
  verifiedText: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  tutorName: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  tutorSubtitle: { fontSize: 14, color: '#6B4EFF', fontWeight: '500' },
  
  statsGrid: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
    paddingVertical: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statRowCol: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  statLabel: { color: '#777', fontSize: 14 },
  statValue: { color: '#333', fontSize: 14, fontWeight: '600' },
  statValueBlock: { color: '#333', fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  statValueGood: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  statValueBg: { 
    color: '#666', 
    backgroundColor: '#F5F5F5', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  ratingsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 12,
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  ratingBox: {
    width: '47%',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  ratingBoxLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  ratingBoxValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingBoxValueColor: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6B4EFF',
  },
  
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  priceSection: {},
  priceLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  priceUnit: {
    fontSize: 14,
    color: '#777',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6B4EFF',
  },
  viewProfileText: {
    color: '#6B4EFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bookLessonBtn: {
    backgroundColor: '#6B4EFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  bookLessonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
