import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import apiClient from '../../api/client';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';

const TutorProfileScreen = () => {
  const { colors } = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [introVideoUri, setIntroVideoUri] = useState<string | null>(null);
  const [videoChanged, setVideoChanged] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const player = useVideoPlayer(introVideoUri);

  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [tutorSubjects, setTutorSubjects] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('subjects/')
      .then(res => setAvailableSubjects(res.data))
      .catch(() => {});

    apiClient.get('profile/me/')
      .then(res => {
        setBio(res.data.bio || '');
        setQualifications(res.data.qualifications || '');
        setExperienceYears(String(res.data.experience_years || ''));
        if (res.data.profile_photo) {
          setProfilePhotoUri(res.data.profile_photo);
        }
        if (res.data.intro_video) {
          setIntroVideoUri(res.data.intro_video);
        }
        if (res.data.subjects) {
          setTutorSubjects(res.data.subjects.map((s: any) => ({
            id: s.id, name: s.name, course_duration_hours: s.course_duration_hours, hourly_rate: s.hourly_rate
          })));
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const toggleSubject = (sub: any) => {
    setTutorSubjects(prev => {
      if (prev.some(s => s.id === sub.id)) {
        return prev.filter(s => s.id !== sub.id);
      } else {
        return [...prev, { id: sub.id, name: sub.name, course_duration_hours: '', hourly_rate: '' }];
      }
    });
  };

  const updateTutorSubject = (id: number, field: string, value: string) => {
    setTutorSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setProfilePhotoUri(result.assets[0].uri);
      setPhotoChanged(true);
    }
  };

  const removeImage = () => {
    setProfilePhotoUri(null);
    setPhotoChanged(true);
  };

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setIntroVideoUri(result.assets[0].uri);
      setVideoChanged(true);
    }
  };

  const removeVideo = () => {
    setIntroVideoUri(null);
    setVideoChanged(true);
  };

  const handleSave = () => {
    setSaving(true);
    const formData = new FormData();
    formData.append('bio', bio);
    formData.append('qualifications', qualifications);
    formData.append('experience_years', experienceYears);
    formData.append('subjects', JSON.stringify(tutorSubjects.map(ts => ({
      subject_id: ts.id,
      course_duration_hours: Number(ts.course_duration_hours) || 0,
      hourly_rate: Number(ts.hourly_rate) || 0
    }))));

    if (photoChanged) {
      if (profilePhotoUri) {
        let filename = profilePhotoUri.split('/').pop() || 'photo.jpg';
        let match = /\.(\w+)$/.exec(filename);
        let type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('profile_photo', { uri: profilePhotoUri, name: filename, type });
      } else {
        formData.append('profile_photo', '');
      }
    }

    if (videoChanged) {
      if (introVideoUri) {
        let filename = introVideoUri.split('/').pop() || 'video.mp4';
        let match = /\.(\w+)$/.exec(filename);
        let type = match ? `video/${match[1]}` : `video/mp4`;
        // @ts-ignore
        formData.append('intro_video', { uri: introVideoUri, name: filename, type });
      } else {
        formData.append('intro_video', '');
      }
    }

    apiClient.patch('profile/me/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => {
        Alert.alert('Saved!', 'Your profile has been updated.');
        setPhotoChanged(false);
        setVideoChanged(false);
        if (res.data.profile_photo) setProfilePhotoUri(res.data.profile_photo);
        if (res.data.intro_video) setIntroVideoUri(res.data.intro_video);
      })
      .catch(() => Alert.alert('Error', 'Could not update profile.'))
      .finally(() => setSaving(false));
  };

  const s = createStyles(colors);

  if (loading) return (
    <View style={s.loadingContainer}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  const inputStyle = (field: string) => [
    s.inputWrapper,
    focusedField === field && s.inputWrapperFocused,
  ];

  const initials = user?.username?.[0]?.toUpperCase() || '?';

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Profile Header */}
      <View style={s.profileHeader}>
        <View style={s.headerDecor} />
        <View style={s.avatarSection}>
          <View style={s.avatarRing}>
            {profilePhotoUri ? (
              <Image source={{ uri: profilePhotoUri }} style={s.avatarImage} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={s.photoActions}>
            <TouchableOpacity style={s.photoBtn} onPress={pickImage} activeOpacity={0.8}>
              <Text style={s.photoBtnText}>📷  Change Photo</Text>
            </TouchableOpacity>
            {profilePhotoUri && (
              <TouchableOpacity style={s.removeBtn} onPress={removeImage} activeOpacity={0.8}>
                <Text style={s.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={s.profileName}>{user?.username}</Text>
        <Text style={s.profileEmail}>{user?.email}</Text>
        <View style={s.verifiedBadge}>
          <Text style={s.verifiedText}>✦ Tutor</Text>
        </View>
      </View>

      {/* Form */}
      <View style={s.formCard}>
        <Text style={s.formSectionTitle}>Profile Details</Text>

        <Text style={s.fieldLabel}>Qualifications</Text>
        <View style={[inputStyle('qual'), s.multilineWrapper]}>
          <TextInput
            style={[s.input, s.multilineInput]}
            multiline
            value={qualifications}
            onChangeText={setQualifications}
            placeholder="e.g. MSc Mathematics, B.Ed"
            placeholderTextColor={colors.textMuted}
            onFocus={() => setFocusedField('qual')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <Text style={s.fieldLabel}>Subjects You Teach</Text>
        <View style={s.subjectsGrid}>
          {availableSubjects.map(sub => {
            const isSelected = tutorSubjects.some(ts => ts.id === sub.id);
            return (
              <TouchableOpacity
                key={sub.id}
                style={[s.subjectChip, isSelected && s.subjectChipActive]}
                onPress={() => toggleSubject(sub)}
                activeOpacity={0.8}
              >
                <Text style={[s.subjectChipText, isSelected && s.subjectChipTextActive]}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tutorSubjects.length > 0 && (
          <View style={{ marginTop: spacing['4'] }}>
            <Text style={s.fieldLabel}>Subject Rates & Duration</Text>
            {tutorSubjects.map((ts) => (
              <View key={ts.id} style={s.subjectDetailsCard}>
                <Text style={s.subjectDetailsTitle}>{ts.name}</Text>
                <View style={s.twoColRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Hourly Rate (₹)</Text>
                    <View style={inputStyle(`rate-${ts.id}`)}>
                      <TextInput
                        style={s.input}
                        value={String(ts.hourly_rate || '')}
                        onChangeText={(text) => updateTutorSubject(ts.id, 'hourly_rate', text)}
                        keyboardType="numeric"
                        placeholder="e.g. 500"
                        placeholderTextColor={colors.textMuted}
                        onFocus={() => setFocusedField(`rate-${ts.id}`)}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Course Duration (hrs)</Text>
                    <View style={inputStyle(`duration-${ts.id}`)}>
                      <TextInput
                        style={s.input}
                        value={String(ts.course_duration_hours || '')}
                        onChangeText={(text) => updateTutorSubject(ts.id, 'course_duration_hours', text)}
                        keyboardType="numeric"
                        placeholder="e.g. 15"
                        placeholderTextColor={colors.textMuted}
                        onFocus={() => setFocusedField(`duration-${ts.id}`)}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={s.fieldLabel}>Bio</Text>
        <View style={[inputStyle('bio'), s.multilineWrapper]}>
          <TextInput
            style={[s.input, s.multilineInput, { height: 100 }]}
            multiline
            value={bio}
            onChangeText={setBio}
            placeholder="Describe yourself to students..."
            placeholderTextColor={colors.textMuted}
            onFocus={() => setFocusedField('bio')}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={{ marginBottom: spacing['4'] }}>
          <Text style={s.fieldLabel}>Years Exp.</Text>
          <View style={inputStyle('exp')}>
              <TextInput
                style={s.input}
                value={experienceYears}
                onChangeText={setExperienceYears}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor={colors.textMuted}
                onFocus={() => setFocusedField('exp')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

        <Text style={s.fieldLabel}>Intro Video (Optional)</Text>
        <View style={s.videoSection}>
          {introVideoUri ? (
            <View style={s.videoContainer}>
              <VideoView
                player={player}
                allowsFullscreen
                allowsPictureInPicture
                style={s.videoPlayer}
              />
              <TouchableOpacity style={s.removeVideoBtn} onPress={removeVideo}>
                <Text style={s.removeVideoBtnText}>Remove Video</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.uploadVideoBtn} onPress={pickVideo}>
              <Text style={s.uploadVideoText}>🎥 Upload Intro Video</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  profileHeader: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    paddingTop: spacing['10'],
    paddingBottom: spacing['6'],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
    marginBottom: spacing['4'],
    borderBottomWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute', top: -80, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: colors.primary, opacity: 0.08,
  },
  avatarSection: { alignItems: 'center', marginBottom: spacing['4'] },
  avatarRing: {
    width: 100, height: 100, borderRadius: radius.full,
    borderWidth: 3, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
    marginBottom: spacing['3'], overflow: 'hidden',
  },
  avatarImage: { width: 100, height: 100 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: radius.full,
    backgroundColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: colors.primary, fontSize: typography.size['5xl'], fontWeight: typography.weight.extrabold },
  photoActions: { flexDirection: 'row', gap: spacing['2'] },
  photoBtn: {
    backgroundColor: colors.primary + '20', paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'], borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.primary + '50',
  },
  photoBtnText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  removeBtn: {
    backgroundColor: colors.errorBg, paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'], borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.error + '40',
  },
  removeBtnText: { color: colors.error, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  profileName: {
    color: colors.text, fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold, letterSpacing: typography.tracking.tight,
  },
  profileEmail: { color: colors.textSecondary, fontSize: typography.size.sm, marginTop: 2 },
  verifiedBadge: {
    marginTop: spacing['3'], backgroundColor: colors.accent + '20',
    borderRadius: radius.full, paddingHorizontal: spacing['4'], paddingVertical: 4,
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  verifiedText: { color: colors.accent, fontSize: typography.size.xs, fontWeight: typography.weight.bold, letterSpacing: typography.tracking.widest },

  formCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl, marginHorizontal: spacing['5'],
    padding: spacing['5'], borderWidth: 1, borderColor: colors.glassBorder,
    marginBottom: spacing['8'],
  },
  formSectionTitle: {
    fontSize: typography.size.lg, fontWeight: typography.weight.extrabold,
    color: colors.text, marginBottom: spacing['4'],
  },
  fieldLabel: {
    fontSize: typography.size.xs, fontWeight: typography.weight.bold,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: typography.tracking.widest, marginBottom: spacing['2'], marginTop: spacing['4'],
  },
  inputWrapper: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing['4'],
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  multilineWrapper: { paddingVertical: spacing['2'] },
  input: { fontSize: typography.size.base, color: colors.text, paddingVertical: spacing['3'] },
  multilineInput: { textAlignVertical: 'top', height: 80 },
  twoColRow: { flexDirection: 'row', gap: spacing['3'] },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['6'],
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base },

  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['2'] },
  subjectChip: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: spacing['4'], paddingVertical: spacing['2'],
    backgroundColor: colors.surface,
  },
  subjectChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  subjectChipText: { color: colors.textSecondary, fontWeight: typography.weight.semibold, fontSize: typography.size.sm },
  subjectChipTextActive: { color: colors.primary },

  subjectDetailsCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing['4'], marginBottom: spacing['3'],
  },
  subjectDetailsTitle: {
    fontSize: typography.size.sm, fontWeight: typography.weight.bold,
    color: colors.primary, marginBottom: spacing['2'],
  },

  videoSection: { marginTop: spacing['2'] },
  uploadVideoBtn: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary + '50',
    borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing['6'],
    alignItems: 'center', justifyContent: 'center'
  },
  uploadVideoText: { color: colors.primary, fontWeight: typography.weight.bold },
  videoContainer: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', marginBottom: spacing['2'] },
  videoPlayer: { width: '100%', height: 200 },
  removeVideoBtn: { backgroundColor: colors.errorBg, padding: spacing['2'], alignItems: 'center' },
  removeVideoBtnText: { color: colors.error, fontWeight: typography.weight.bold },
});

export default TutorProfileScreen;
