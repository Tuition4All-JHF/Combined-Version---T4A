import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, KeyboardAvoidingView
} from 'react-native';
import { useDispatch } from 'react-redux';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import T4ALogo from '../components/T4ALogo';
import apiClient from '../api/client';
import { loginSuccess } from '../redux/authSlice';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

interface Subject {
  id: number;
  name: string;
}

interface CourseData {
  id: number;
  categoryId: number | null;
  description: string;
  aboutTeaching: string;
  skills: string;
  experience: string;
  teacherPrice: string; // hourly fee
  totalDurationHours: string;
  totalAmount: string; // calculated
  introVideo: any;
  certifications: { file: any; name: string }[];
}

const RegisterScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState('STUDENT');

  // Step 1: Account
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<any>(null);
  const [error, setError] = useState('');

  // Step 2: Tutor Profile & Courses
  const [profileVideo, setProfileVideo] = useState<any>(null);
  const [profileBio, setProfileBio] = useState('');
  const [profileExperienceYears, setProfileExperienceYears] = useState('');
  const [profileQualifications, setProfileQualifications] = useState('');

  const [courses, setCourses] = useState<CourseData[]>([
    {
      id: Date.now(), categoryId: null, description: '', aboutTeaching: '', skills: '',
      experience: '', teacherPrice: '', totalDurationHours: '', totalAmount: '',
      introVideo: null, certifications: []
    }
  ]);

  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get('subjects/')
      .then(res => setAvailableSubjects(res.data))
      .catch(err => console.log('Error fetching subjects', err));
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setProfilePhoto(result.assets[0]);
    }
  };

  const pickVideo = async (setter: any) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setter(result.assets[0]);
    }
  };

  const pickDocument = async (setter: any) => {
    let result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (result.assets && result.assets.length > 0) {
      setter(result.assets[0]);
    }
  };

  const updateCourse = (index: number, field: keyof CourseData, value: any) => {
    const updated = [...courses];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate Total Amount if hourly fee or duration changes
    if (field === 'teacherPrice' || field === 'totalDurationHours') {
      const hFee = parseFloat(field === 'teacherPrice' ? value : updated[index].teacherPrice) || 0;
      const tDur = parseFloat(field === 'totalDurationHours' ? value : updated[index].totalDurationHours) || 0;
      updated[index].totalAmount = (hFee * tDur).toString();
    }

    setCourses(updated);
  };

  const addCertificate = (courseIndex: number) => {
    const updated = [...courses];
    updated[courseIndex].certifications.push({ file: null, name: '' });
    setCourses(updated);
  };

  const removeCertificate = (courseIndex: number, certIndex: number) => {
    const updated = [...courses];
    updated[courseIndex].certifications.splice(certIndex, 1);
    setCourses(updated);
  };

  const updateCertificate = (courseIndex: number, certIndex: number, field: 'file' | 'name', value: any) => {
    const updated = [...courses];
    updated[courseIndex].certifications[certIndex][field] = value;
    setCourses(updated);
  };

  const addAnotherCourse = () => {
    setCourses([...courses, {
      id: Date.now(), categoryId: null, description: '', aboutTeaching: '', skills: '',
      experience: '', teacherPrice: '', totalDurationHours: '', totalAmount: '',
      introVideo: null, certifications: []
    }]);
  };

  const removeCourse = (index: number) => {
    if (courses.length > 1) {
      const updated = [...courses];
      updated.splice(index, 1);
      setCourses(updated);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!username || !email || !password) { setError('Please fill all required fields'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
      setError('');
      if (role === 'TUTOR') {
        setStep(2);
      } else {
        handleRegister();
      }
    }
  };

  const handleRegister = async () => {
    if (role === 'TUTOR' && step === 2) {
      // Validate first course at least
      if (!courses[0].categoryId || !courses[0].description || !courses[0].teacherPrice) {
        setError('Please fill required fields for Course #1'); return;
      }
    }
    setError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('phone_number', phoneNumber);
      formData.append('role', role === 'TUTOR' ? 'teacher' : role.toLowerCase());

      if (profilePhoto) {
        formData.append('profile_photo', { uri: profilePhoto.uri, name: profilePhoto.fileName || 'photo.jpg', type: profilePhoto.mimeType || 'image/jpeg' } as any);
      }

      if (role === 'TUTOR') {
        if (profileVideo) {
          formData.append('intro_video', { uri: profileVideo.uri, name: profileVideo.name, type: profileVideo.mimeType || 'video/mp4' } as any);
        }
        if (profileBio) formData.append('bio', profileBio);
        if (profileExperienceYears) formData.append('experience_years', profileExperienceYears);
        if (profileQualifications) formData.append('qualifications', profileQualifications);

        // Build courses json
        const coursesPayload = courses.map((c) => ({
          categoryId: c.categoryId,
          description: c.description,
          aboutTeaching: c.aboutTeaching,
          skills: c.skills,
          experience: c.experience,
          teacherPrice: c.teacherPrice,
          hourlyFee: c.teacherPrice,
          totalDurationHours: c.totalDurationHours,
          totalAmount: c.totalAmount
        }));

        formData.append('courses_data', JSON.stringify(coursesPayload));

        courses.forEach((c, index) => {
          if (c.introVideo) {
            formData.append(`course_${index}_intro_video`, { uri: c.introVideo.uri, name: c.introVideo.name, type: c.introVideo.mimeType || 'video/mp4' } as any);
          }
          if (c.certifications && c.certifications.length > 0) {
            c.certifications.forEach((certObj, certIndex) => {
              formData.append(`course_${index}_cert_file_${certIndex}`, { uri: certObj.file.uri, name: certObj.file.name, type: certObj.file.mimeType || 'application/pdf' } as any);
              formData.append(`course_${index}_cert_name_${certIndex}`, certObj.name || 'Certificate');
            });
          }
        });
      }

      await apiClient.post('auth/register/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const loginRes = await apiClient.post('auth/login/', { username, password });
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.access}`;
      
      const userResponse = await apiClient.get('auth/me/', {
        headers: { Authorization: `Bearer ${loginRes.data.access}` },
      });
      
      dispatch(loginSuccess({ token: loginRes.data.access, user: userResponse.data }));
    } catch (err: any) {
      console.error(err.response?.data || err);
      if (err.response?.data) {
        const data = err.response.data;
        if (data.detail) {
          setError(data.detail);
        } else if (typeof data === 'object') {
          // Extract the first validation error message
          const firstKey = Object.keys(data)[0];
          const firstError = data[firstKey];
          if (Array.isArray(firstError)) {
            setError(`${firstKey}: ${firstError[0]}`);
          } else {
            setError(typeof firstError === 'string' ? firstError : 'Registration failed. Try again.');
          }
        } else {
          setError('Registration failed. Try again.');
        }
      } else {
        setError('Registration failed. Try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = (f: string) => [styles.inputWrapper, focusedField === f && styles.inputWrapperFocused];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.orbTop} />

        <View style={styles.header}>
          <T4ALogo scale={1.5} theme="dark" />
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSub}>
            {step === 1 ? 'Join Tution4All today' : 'Tutor Profile Setup'}
          </Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.card}>
          {step === 1 && (
            <>
              <Text style={styles.label}>I want to register as a</Text>
              <View style={styles.roleToggle}>
                {['STUDENT', 'TUTOR', 'PARENT'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                      {r === 'TUTOR' ? 'Tutor' : r.charAt(0) + r.slice(1).toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Username*</Text>
              <View style={inputStyle('username')}>
                <TextInput style={[styles.input, { fontWeight: "normal" }]} placeholderTextColor={colors.textMuted} placeholder="johndoe" value={username} onChangeText={setUsername} autoCapitalize="none" onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>Email Address</Text>
              <View style={inputStyle('email')}>
                <TextInput style={[styles.input, { fontWeight: "normal" }]} placeholderTextColor={colors.textMuted} placeholder="your@gmail.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>First Name</Text>
              <View style={inputStyle('firstName')}>
                <TextInput style={[styles.input, { fontWeight: "normal" }]} placeholderTextColor={colors.textMuted} placeholder="John" value={firstName} onChangeText={setFirstName} onFocus={() => setFocusedField('firstName')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>Last Name</Text>
              <View style={inputStyle('lastName')}>
                <TextInput style={[styles.input, { fontWeight: "normal" }]} placeholderTextColor={colors.textMuted} placeholder="Doe" value={lastName} onChangeText={setLastName} onFocus={() => setFocusedField('lastName')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>Phone Number</Text>
              <View style={inputStyle('phone')}>
                <TextInput style={[styles.input, { fontWeight: "normal" }]} placeholderTextColor={colors.textMuted} placeholder="9874367806" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>Profile Photo</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity style={[styles.uploadBtn, { flex: 1 }]} onPress={pickImage} activeOpacity={0.8}>
                  <Text style={styles.uploadIcon}>📷</Text>
                  <Text style={styles.uploadText}>{profilePhoto ? profilePhoto.fileName || 'Photo Selected' : 'Upload Profile Photo'}</Text>
                </TouchableOpacity>
                {profilePhoto && (
                  <TouchableOpacity onPress={() => setProfilePhoto(null)} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>✖</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Password*</Text>
              <View style={inputStyle('password')}>
                <TextInput style={[styles.input, { flex: 1, fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="Create a password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirm Password*</Text>
              <View style={inputStyle('confirm')}>
                <TextInput style={[styles.input, { flex: 1, fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="Confirm password" secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} onFocus={() => setFocusedField('confirm')} onBlur={() => setFocusedField(null)} />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                  <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>Tutor Profile Setup</Text>
              </View>

              <Text style={styles.label}>Intro Video (Optional)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity style={[styles.uploadBtn, { flex: 1 }]} onPress={() => pickVideo(setProfileVideo)} activeOpacity={0.8}>
                  <Text style={styles.uploadIcon}>🎥</Text>
                  <Text style={styles.uploadText}>{profileVideo ? profileVideo.name : 'Upload Profile Intro Video'}</Text>
                </TouchableOpacity>
                {profileVideo && (
                  <TouchableOpacity onPress={() => setProfileVideo(null)} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>✖</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Bio (Optional)</Text>
              <View style={inputStyle('profileBio')}>
                <TextInput style={[styles.input, { textAlignVertical: 'top', fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="A short bio about yourself" multiline value={profileBio} onChangeText={setProfileBio} onFocus={() => setFocusedField('profileBio')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>Total Experience (Years)</Text>
              <View style={inputStyle('profileExp')}>
                <TextInput style={[styles.input, { fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="e.g. 5" keyboardType="numeric" value={profileExperienceYears} onChangeText={setProfileExperienceYears} onFocus={() => setFocusedField('profileExp')} onBlur={() => setFocusedField(null)} />
              </View>

              <Text style={styles.label}>Qualifications</Text>
              <View style={inputStyle('profileQual')}>
                <TextInput style={[styles.input, { textAlignVertical: 'top', fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="e.g. MSc Mathematics" multiline value={profileQualifications} onChangeText={setProfileQualifications} onFocus={() => setFocusedField('profileQual')} onBlur={() => setFocusedField(null)} />
              </View>

              <View style={styles.sectionHeader}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>Setup Your Courses</Text>
              </View>

              {courses.map((course, index) => (
                <View key={course.id} style={styles.courseCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.courseIndexTitle}>Course #{index + 1}</Text>
                    {index > 0 && (
                      <TouchableOpacity onPress={() => removeCourse(index)}>
                        <Text style={{ color: colors.error, fontSize: 12, fontWeight: 'bold' }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.label}>Select Subject/Course</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={course.categoryId}
                      onValueChange={(val) => updateCourse(index, 'categoryId', val)}
                      style={{ color: colors.text, height: 50 }}
                      dropdownIconColor={colors.primary}
                    >
                      <Picker.Item label="Select a subject..." value={0} color={colors.textMuted} />
                      {availableSubjects.map(sub => (
                        <Picker.Item key={sub.id} label={sub.name} value={sub.id} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Course Description</Text>
                  <View style={[inputStyle(`cdesc_${index}`), { height: 80, alignItems: 'flex-start' }]}>
                    <TextInput style={[styles.input, { textAlignVertical: 'top', fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="What will they learn?" multiline value={course.description} onChangeText={(v) => updateCourse(index, 'description', v)} onFocus={() => setFocusedField(`cdesc_${index}`)} onBlur={() => setFocusedField(null)} />
                  </View>

                  <Text style={styles.label}>About your teaching style</Text>
                  <View style={[inputStyle(`about_${index}`), { height: 80, alignItems: 'flex-start' }]}>
                    <TextInput style={[styles.input, { textAlignVertical: 'top', fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="How do you teach?" multiline value={course.aboutTeaching} onChangeText={(v) => updateCourse(index, 'aboutTeaching', v)} onFocus={() => setFocusedField(`about_${index}`)} onBlur={() => setFocusedField(null)} />
                  </View>

                  <Text style={styles.label}>Experience</Text>
                  <View style={[inputStyle(`exp_${index}`), { height: 80, alignItems: 'flex-start' }]}>
                    <TextInput style={[styles.input, { textAlignVertical: 'top', fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="Your experience related to this subject" multiline value={course.experience} onChangeText={(v) => updateCourse(index, 'experience', v)} onFocus={() => setFocusedField(`exp_${index}`)} onBlur={() => setFocusedField(null)} />
                  </View>

                  <View style={styles.rowTwoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Per student (hourly) (₹)</Text>
                      <View style={inputStyle(`price_${index}`)}>
                        <TextInput style={[styles.input, { fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="e.g. 500" keyboardType="numeric" value={course.teacherPrice} onChangeText={(v) => updateCourse(index, 'teacherPrice', v)} onFocus={() => setFocusedField(`price_${index}`)} onBlur={() => setFocusedField(null)} />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Total Duration (hours)</Text>
                      <View style={inputStyle(`duration_${index}`)}>
                        <TextInput style={[styles.input, { fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="e.g. 30" keyboardType="numeric" value={course.totalDurationHours} onChangeText={(v) => updateCourse(index, 'totalDurationHours', v)} onFocus={() => setFocusedField(`duration_${index}`)} onBlur={() => setFocusedField(null)} />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.label}>Total Amount (₹)</Text>
                  <View style={inputStyle(`amount_${index}`)}>
                    <TextInput style={[styles.input, { fontWeight: 'normal', color: colors.primary }]} placeholderTextColor={colors.textMuted} placeholder="Total course fee" keyboardType="numeric" value={course.totalAmount} editable={false} />
                  </View>

                  <Text style={styles.label}>Course Intro Video (Optional)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity style={[styles.uploadBtn, { flex: 1 }]} onPress={() => pickVideo((f: any) => updateCourse(index, 'introVideo', f))} activeOpacity={0.8}>
                      <Text style={styles.uploadIcon}>🎥</Text>
                      <Text style={styles.uploadText}>{course.introVideo ? course.introVideo.name : 'Upload Course Intro Video'}</Text>
                    </TouchableOpacity>
                    {course.introVideo && (
                      <TouchableOpacity onPress={() => updateCourse(index, 'introVideo', null)} style={styles.clearBtn}>
                        <Text style={styles.clearBtnText}>✖</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.label}>Upload Certificates (PDF/Images)</Text>
                  {course.certifications.map((certObj, certIndex) => (
                    <View key={`cert_${index}_${certIndex}`} style={styles.rowTwoCol}>
                      <View style={[inputStyle(`certName_${index}_${certIndex}`), { flex: 1, paddingHorizontal: spacing['2'] }]}>
                        <TextInput style={[styles.input, { fontWeight: 'normal' }]} placeholderTextColor={colors.textMuted} placeholder="Document Name" value={certObj.name} onChangeText={(v) => updateCertificate(index, certIndex, 'name', v)} onFocus={() => setFocusedField(`certName_${index}_${certIndex}`)} onBlur={() => setFocusedField(null)} />
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
                        <TouchableOpacity style={[styles.uploadBtn, { flex: 1, marginTop: 0, height: 48, justifyContent: 'center' }]} onPress={() => pickDocument((f: any) => updateCertificate(index, certIndex, 'file', f))} activeOpacity={0.8}>
                          <Text style={[styles.uploadText, { textAlign: 'center' }]}>{certObj.file ? 'Selected' : 'Choose File'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeCertificate(index, certIndex)} style={[styles.clearBtn, { height: 48, width: 40 }]}>
                          <Text style={styles.clearBtnText}>✖</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => addCertificate(index)} style={{ marginTop: spacing['2'], alignSelf: 'flex-start' }}>
                    <Text style={{ color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.sm }}>+ Add Certificate</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.outlineBtn} onPress={addAnotherCourse}>
                <Text style={styles.outlineBtnText}>+ Add Another Course</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)} disabled={isSubmitting}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.registerBtn, step > 1 && { flex: 2 }]} onPress={step === 2 || role !== 'TUTOR' ? handleRegister : handleNext} disabled={isSubmitting}>
            <Text style={styles.registerBtnText}>{isSubmitting ? 'Processing...' : (step === 2 || role !== 'TUTOR' ? 'Submit Registration' : 'Next →')}</Text>
          </TouchableOpacity>
        </View>

        {/* Login link */}
        {step === 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkAccent}>Login here</Text></Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingHorizontal: spacing['5'], paddingBottom: spacing['10'], paddingTop: spacing['10'] },
  orbTop: { position: 'absolute', top: -100, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: colors.accent, opacity: 0.1 },
  header: { alignItems: 'center', marginBottom: spacing['6'] },
  headerTitle: { fontSize: typography.size['3xl'], fontWeight: typography.weight.extrabold, color: colors.text, marginTop: spacing['3'], letterSpacing: typography.tracking.tight },
  headerSub: { fontSize: typography.size.md, color: colors.textSecondary, marginTop: spacing['1'] },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing['3'], marginBottom: spacing['4'], borderWidth: 1, borderColor: colors.error + '40' },
  errorText: { color: colors.error, fontSize: typography.size.sm, textAlign: 'center' },

  card: { backgroundColor: colors.surfaceElevated, borderRadius: radius.xl, padding: spacing['5'], borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing['4'] },

  courseCard: { backgroundColor: colors.surface, padding: spacing['4'], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing['4'] },
  courseIndexTitle: { color: colors.primary, fontWeight: typography.weight.bold, fontSize: typography.size.base, marginBottom: spacing['2'] },

  label: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: typography.tracking.widest, marginBottom: spacing['2'], marginTop: spacing['4'] },
  inputWrapper: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing['4'], flexDirection: 'row', alignItems: 'center' },
  inputWrapperFocused: { borderColor: colors.primary },
  input: { fontSize: typography.size.base, color: colors.text, paddingVertical: spacing['3'], flex: 1 },
  eyeBtn: { padding: spacing['2'] },
  eyeIcon: { fontSize: 18 },

  pickerWrapper: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },

  roleToggle: { flexDirection: 'row', gap: spacing['3'], marginTop: spacing['2'] },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing['3'], backgroundColor: colors.surface },
  roleBtnActive: { backgroundColor: colors.primary + '25', borderColor: colors.primary },
  roleText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.textSecondary },
  roleTextActive: { color: colors.primary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing['6'], marginBottom: spacing['2'] },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: spacing['2'] },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text },

  rowTwoCol: { flexDirection: 'row', gap: spacing['3'], marginTop: spacing['2'] },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'], borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary + '60', borderRadius: radius.md, padding: spacing['4'], backgroundColor: colors.primary + '08', marginTop: spacing['2'] },
  uploadIcon: { fontSize: 20 },
  uploadText: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: typography.weight.medium, flex: 1 },
  clearBtn: { backgroundColor: colors.error + '20', borderWidth: 1, borderColor: colors.error + '50', padding: 12, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginTop: spacing['2'] },
  clearBtnText: { color: colors.error, fontSize: 14, fontWeight: 'bold' },

  outlineBtn: { alignSelf: 'center', marginTop: spacing['5'], paddingHorizontal: spacing['5'], paddingVertical: spacing['3'], borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.success, backgroundColor: colors.success + '10' },
  outlineBtnText: { color: colors.success, fontSize: typography.size.base, fontWeight: typography.weight.bold },

  btnRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['4'] },
  backBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing['4'], alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  backBtnText: { color: colors.text, fontWeight: typography.weight.bold, fontSize: typography.size.base },
  registerBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing['4'], alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  registerBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.base, letterSpacing: typography.tracking.wide },

  loginLink: { alignItems: 'center', marginBottom: spacing['6'] },
  loginLinkText: { color: colors.textSecondary, fontSize: typography.size.sm },
  loginLinkAccent: { color: colors.primary, fontWeight: typography.weight.semibold },
});

export default RegisterScreen;

