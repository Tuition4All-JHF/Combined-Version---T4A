import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, TextInput, Linking, Modal } from 'react-native';
import { adminApi } from '../../api/adminApi';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function AdminTutorProfile() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const tutorId = route.params?.tutorId;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  
  // Modal State
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<number | null>(null);
  const [adminHourlyFee, setAdminHourlyFee] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [approvingCourse, setApprovingCourse] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [tutorId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getProfileDetail(tutorId);
      setProfile(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load tutor profile');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const openApproveModal = (course: any) => {
    setSelectedCourseId(course.id);
    setAdminHourlyFee(course.hourly_fee);
    setFinalPrice(course.price && parseFloat(course.price) > 0 ? course.price : course.teacher_price);
    setAdminComment('');
  };

  const handleAdminHourlyFeeChange = (val: string) => {
    setAdminHourlyFee(val);
    const course = profile.courses.find((c: any) => c.id === selectedCourseId);
    if (course) {
      const hFee = parseFloat(val) || 0;
      const tDuration = parseFloat(course.total_duration_hours) || 0;
      setFinalPrice((hFee * tDuration).toString());
    }
  };

  const handleApproveCourseSubmit = async () => {
    if (!selectedCourseId) return;
    try {
      setApprovingCourse(true);
      const course = profile.courses.find((c: any) => c.id === selectedCourseId);
      const tDuration = parseFloat(course.total_duration_hours) || 0;
      const hFee = parseFloat(adminHourlyFee) || 0;
      const teacherPrice = (hFee * tDuration).toString();

      await adminApi.approveCourse(selectedCourseId, {
        admin_hourly_fee: adminHourlyFee,
        teacher_price: teacherPrice,
        final_price: finalPrice,
        admin_comment: adminComment
      });
      
      Alert.alert('Success', 'Course approved successfully');
      setSelectedCourseId(null);
      fetchProfile();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve course');
    } finally {
      setApprovingCourse(false);
    }
  };

  const handleVerifyTutor = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      setVerifying(true);
      await adminApi.verifyTutor(tutorId, status);
      Alert.alert('Success', `Tutor ${status.toLowerCase()} successfully`);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', `Failed to ${status.toLowerCase()} tutor`);
    } finally {
      setVerifying(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Loading tutor profile...</Text>
      </View>
    );
  }

  const isPending = profile.verification_status === 'PENDING';
  const photoUrl = profile.profile_photo_url || profile.profile_photo;
  const certUrl = profile.certification_url || profile.certification;
  const videoUrl = profile.intro_video_url || profile.intro_video;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tutor Profile</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Profile Details (Same as before) */}
        <View style={s.card}>
          <View style={s.identityRow}>
            <View style={s.avatarContainer}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarText}>{(profile.first_name || profile.username || 'U')[0].toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={s.identityInfo}>
              <Text style={s.tutorName}>{profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : profile.username}</Text>
              <Text style={s.tutorEmail}>{profile.email}</Text>
            </View>
            <View style={[s.badge, isPending ? s.badgePending : s.badgeApproved]}>
              <Text style={[s.badgeText, isPending ? s.badgeTextPending : s.badgeTextApproved]}>
                {profile.verification_status}
              </Text>
            </View>
          </View>

          <View style={s.divider} />

          <Text style={s.sectionLabel}>Bio</Text>
          <Text style={s.bioText}>{profile.bio || 'Not provided'}</Text>
          
          {profile?.intro_video && (
            <TouchableOpacity 
              style={{ marginTop: 12, backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' }}
              onPress={() => Linking.openURL(profile.intro_video)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>▶ Play Tutor Intro Video</Text>
            </TouchableOpacity>
          )}
          
          {profile?.documents && profile.documents.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 8, color: colors.text }}>Documents & Certificates:</Text>
              {profile.documents.map((doc: any) => (
                <TouchableOpacity 
                  key={doc.id}
                  style={{ padding: 8, backgroundColor: '#e2e8f0', borderRadius: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => Linking.openURL(doc.file_url)}
                >
                  <Text style={{ color: '#3b82f6', fontWeight: '500' }}>📄 {doc.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.detailsGrid}>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Experience</Text>
              <Text style={s.detailValue}>{profile.experience_years ? `${profile.experience_years} years` : 'Not provided'}</Text>
            </View>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>Qualifications</Text>
              <Text style={s.detailValue}>{profile.qualifications || 'Not provided'}</Text>
            </View>
          </View>

          {/* Media Attachments */}
          {certUrl && (
            <TouchableOpacity style={s.mediaLinkBtn} onPress={() => Linking.openURL(certUrl)}>
              <Text style={s.mediaLinkIcon}>📄</Text>
              <Text style={s.mediaLinkText}>View Certification</Text>
              <Text style={s.mediaLinkArrow}>↗</Text>
            </TouchableOpacity>
          )}
          {videoUrl && (
            <TouchableOpacity style={[s.mediaLinkBtn, s.videoLinkBtn]} onPress={() => Linking.openURL(videoUrl)}>
              <Text style={s.mediaLinkIcon}>🎥</Text>
              <Text style={[s.mediaLinkText, { color: colors.error }]}>Watch Intro Video</Text>
              <Text style={[s.mediaLinkArrow, { color: colors.error }]}>▶</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Courses Section */}
        <Text style={s.sectionTitle}>Submitted Courses</Text>
        
        {profile.courses && profile.courses.length > 0 ? (
          profile.courses.map((course: any) => (
            <View key={course.id} style={s.courseCard}>
              <View style={s.courseHeader}>
                <Text style={s.courseCategory}>{course.category_name}</Text>
                <View style={[s.badge, course.status === 'pending' ? s.badgePending : s.badgeApproved]}>
                  <Text style={[s.badgeText, course.status === 'pending' ? s.badgeTextPending : s.badgeTextApproved]}>
                    {course.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <Text style={s.courseTitle}>{course.title}</Text>
              <Text style={s.courseDetailText}>Requested Hourly Fee: <Text style={{fontWeight: 'bold'}}>₹{course.hourly_fee}</Text></Text>

              {course.status === 'pending' && (
                <View style={s.actionRow}>
                  <TouchableOpacity style={s.rejectCourseBtn}>
                    <Text style={s.rejectCourseBtnText}>✕ Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.approveCourseBtn, {backgroundColor: '#3b82f6', marginRight: 8}]} onPress={() => setViewingCourseId(course.id)}>
                    <Text style={s.approveCourseBtnText}>View Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.approveCourseBtn} onPress={() => openApproveModal(course)}>
                    <Text style={s.approveCourseBtnText}>✓ Approve & Set Price</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No courses submitted.</Text>
          </View>
        )}

        {/* Master Verification Buttons */}
        {isPending && (
          <View style={s.masterActionBox}>
            <Text style={s.masterActionTitle}>Final Tutor Verification</Text>
            <Text style={s.masterActionDesc}>Approve this tutor to activate their account on the platform.</Text>
            
            <View style={s.btnRow}>
              <TouchableOpacity style={s.rejectBtn} onPress={() => handleVerifyTutor('REJECTED')} disabled={verifying}>
                <Text style={s.rejectBtnText}>✕ Reject Tutor</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={s.approveBtn} onPress={() => handleVerifyTutor('APPROVED')} disabled={verifying}>
                <Text style={s.approveBtnText}>✓ Verify Tutor</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Approve Course Modal */}
      <Modal visible={!!selectedCourseId} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>✓ Approve Course</Text>
              <TouchableOpacity onPress={() => setSelectedCourseId(null)}>
                <Text style={s.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={s.inputLabel}>Final Hourly Fee for Teacher (₹)</Text>
              <TextInput 
                style={s.input} 
                keyboardType="numeric" 
                value={adminHourlyFee}
                onChangeText={handleAdminHourlyFeeChange}
              />
              <Text style={s.inputSubtext}>The teacher requested ₹{profile?.courses?.find((c:any) => c.id === selectedCourseId)?.hourly_fee}/hr</Text>

              <Text style={[s.inputLabel, { marginTop: spacing['3'] }]}>Set Final Price (Admin + Teacher Share) (₹)</Text>
              <TextInput 
                style={s.input} 
                keyboardType="numeric" 
                value={finalPrice}
                onChangeText={setFinalPrice}
              />

              <Text style={[s.inputLabel, { marginTop: spacing['3'] }]}>Admin Comment (Optional)</Text>
              <TextInput 
                style={[s.input, { height: 60, textAlignVertical: 'top' }]} 
                multiline
                value={adminComment}
                onChangeText={setAdminComment}
                placeholder="Leave a note..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setSelectedCourseId(null)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={s.modalSubmitBtn} 
                onPress={handleApproveCourseSubmit}
                disabled={approvingCourse}
              >
                <Text style={s.modalSubmitText}>
                  {approvingCourse ? 'Approving...' : 'Approve & Publish'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewingCourseId} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Course Details</Text>
              <TouchableOpacity onPress={() => setViewingCourseId(null)}>
                <Text style={s.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {(() => {
                const c = profile?.courses?.find((c:any) => c.id === viewingCourseId);
                if (!c) return null;
                return (
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 8 }}>{c.title}</Text>
                    <View style={{ backgroundColor: '#e2e8f0', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b' }}>{c.category_name}</Text>
                    </View>
                    
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>Description</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>{c.description}</Text>
                    
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>Experience</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>{c.experience || 'Not provided'}</Text>
                    
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>Teaching Methodology</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>{c.about_teaching || 'Not provided'}</Text>
                    
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>Requested Fees</Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>₹{c.hourly_fee} / hr</Text>
                    
                    {c.intro_video && (
                      <TouchableOpacity 
                        style={{ marginTop: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' }}
                        onPress={() => Linking.openURL(c.intro_video)}
                      >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>▶ Watch Course Intro Video</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setViewingCourseId(null)}>
                <Text style={s.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: spacing['3'] },
  loadingText: { color: colors.textSecondary, fontSize: typography.size.sm },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceElevated, paddingTop: spacing['10'], paddingBottom: spacing['4'], paddingHorizontal: spacing['5'],
    borderBottomWidth: 1, borderColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.text },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 24, color: colors.text, fontWeight: 'bold' },

  content: { padding: spacing['4'], paddingBottom: spacing['10'] },
  
  card: { backgroundColor: colors.surfaceElevated, borderRadius: radius.xl, padding: spacing['4'], borderWidth: 1, borderColor: colors.glassBorder, marginBottom: spacing['6'] },
  
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['3'] },
  avatarContainer: { width: 64, height: 64, borderRadius: radius.full, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary + '50' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarFallback: { flex: 1, backgroundColor: colors.primary + '25', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primary, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
  identityInfo: { flex: 1 },
  tutorName: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  tutorEmail: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  badgePending: { backgroundColor: colors.warning + '20', borderColor: colors.warning + '50' },
  badgeApproved: { backgroundColor: colors.success + '20', borderColor: colors.success + '50' },
  badgeText: { fontSize: 10, fontWeight: typography.weight.extrabold, letterSpacing: 1 },
  badgeTextPending: { color: colors.warning },
  badgeTextApproved: { color: colors.success },

  divider: { height: 1, backgroundColor: colors.borderSubtle, marginVertical: spacing['4'] },
  
  sectionLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing['2'] },
  bioText: { fontSize: typography.size.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing['4'] },
  
  detailsGrid: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['4'] },
  detailItem: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing['3'] },
  detailLabel: { fontSize: 10, fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.medium },
  
  mediaLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'], backgroundColor: colors.infoBg, borderRadius: radius.md, padding: spacing['3'], marginBottom: spacing['2'], borderWidth: 1, borderColor: colors.info + '30' },
  videoLinkBtn: { backgroundColor: colors.error + '15', borderColor: colors.error + '30' },
  mediaLinkIcon: { fontSize: 16 },
  mediaLinkText: { flex: 1, color: colors.info, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  mediaLinkArrow: { fontSize: 14, color: colors.info },

  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.text, marginBottom: spacing['3'], marginTop: spacing['2'] },
  
  courseCard: { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing['4'], borderWidth: 1, borderColor: colors.border, marginBottom: spacing['4'] },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] },
  courseCategory: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  courseTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['1'] },
  courseDetailText: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['3'] },
  
  actionRow: { flexDirection: 'row', gap: spacing['2'] },
  approveCourseBtn: { flex: 2, backgroundColor: colors.success, padding: spacing['2'], borderRadius: radius.sm, alignItems: 'center' },
  approveCourseBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  rejectCourseBtn: { flex: 1, backgroundColor: colors.surface, padding: spacing['2'], borderRadius: radius.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '50' },
  rejectCourseBtnText: { color: colors.error, fontWeight: typography.weight.bold, fontSize: typography.size.sm },

  emptyBox: { alignItems: 'center', padding: spacing['4'] },
  emptyText: { color: colors.textMuted },

  masterActionBox: { marginTop: spacing['6'], backgroundColor: colors.surfaceElevated, borderRadius: radius.xl, padding: spacing['5'], borderWidth: 1, borderColor: colors.glassBorder },
  masterActionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.text, marginBottom: spacing['1'] },
  masterActionDesc: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['4'] },
  
  btnRow: { flexDirection: 'row', gap: spacing['3'] },
  rejectBtn: { flex: 1, backgroundColor: colors.surface, padding: spacing['4'], borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '50' },
  rejectBtnText: { color: colors.error, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  approveBtn: { flex: 1, backgroundColor: colors.success, padding: spacing['4'], borderRadius: radius.md, alignItems: 'center' },
  approveBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing['4'] },
  modalContent: { width: '100%', backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, overflow: 'hidden' },
  modalHeader: { backgroundColor: colors.success, padding: spacing['4'], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: colors.white, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  modalCloseBtn: { color: colors.white, fontSize: 20, fontWeight: 'bold' },
  modalBody: { padding: spacing['4'] },
  inputLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text, marginBottom: 4 },
  inputSubtext: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing['3'], color: colors.text, fontSize: typography.size.base },
  modalFooter: { flexDirection: 'row', padding: spacing['4'], borderTopWidth: 1, borderColor: colors.borderSubtle, justifyContent: 'flex-end', gap: spacing['3'] },
  modalCancelBtn: { paddingVertical: spacing['2'], paddingHorizontal: spacing['4'], borderRadius: radius.sm, backgroundColor: colors.surface },
  modalCancelText: { color: colors.textSecondary, fontWeight: typography.weight.bold },
  modalSubmitBtn: { paddingVertical: spacing['2'], paddingHorizontal: spacing['4'], borderRadius: radius.sm, backgroundColor: colors.success },
  modalSubmitText: { color: colors.white, fontWeight: typography.weight.bold },
});
