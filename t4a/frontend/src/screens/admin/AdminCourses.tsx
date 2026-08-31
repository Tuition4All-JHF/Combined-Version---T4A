import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../api/client';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

const AdminCourses = () => {
  const { colors } = useTheme();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [finalPrice, setFinalPrice] = useState('');
  const [adminHourlyFee, setAdminHourlyFee] = useState('');
  const [teacherPrice, setTeacherPrice] = useState('');
  const [adminComment, setAdminComment] = useState('');

  const s = createStyles(colors);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await apiClient.get('/admin/courses/pending/');
      setCourses(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch pending courses');
    } finally {
      setLoading(false);
    }
  };

  const openApproveModal = (course: any) => {
    setSelectedCourse(course);
    setFinalPrice(course.price?.toString() || '');
    setTeacherPrice(course.teacher_price?.toString() || '');
    setAdminHourlyFee(course.hourly_fee?.toString() || '');
    setAdminComment('');
    setShowModal(true);
  };

  const handleApprove = async () => {
    if (!selectedCourse) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/courses/${selectedCourse.id}/approve/`, {
        final_price: final_price || 0,
        admin_hourly_fee: admin_hourly_fee || 0,
        teacher_price: teacher_price || 0,
        admin_comment: admin_comment,
      });
      Alert.alert('Success', 'Course approved and published!');
      setShowModal(false);
      fetchCourses();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to approve course');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Pending Approvals</Text>
      
      {courses.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyIcon}>📝</Text>
          <Text style={s.emptyText}>All caught up!</Text>
          <Text style={s.emptySubText}>No pending courses to review.</Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: spacing['3'] }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.category_name}</Text>
                </View>
                <Text style={s.durationText}>⏱️ {item.total_duration_hours} hrs</Text>
              </View>
              
              <Text style={s.courseTitle}>{item.title}</Text>
              
              <View style={s.tutorContainer}>
                <View style={s.tutorAvatar}>
                  <Text style={s.tutorInitial}>{item.teacher_name?.charAt(0) || 'T'}</Text>
                </View>
                <Text style={s.courseSubtitle}>{item.teacher_name}</Text>
              </View>

              <View style={s.divider} />

              <View style={s.detailsRow}>
                <View style={s.priceBox}>
                  <Text style={s.priceLabel}>Requested Fee</Text>
                  <Text style={s.priceValue}>₹{item.hourly_fee}/hr</Text>
                </View>
                
                <TouchableOpacity style={s.approveBtn} onPress={() => openApproveModal(item)}>
                  <Text style={s.approveBtnText}>Review & Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Approve Course</Text>
              <Text style={s.modalSubtitle} numberOfLines={1}>{selectedCourse?.title}</Text>
            </View>
            
            <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Final Price (₹)</Text>
                <TextInput style={s.input} value={finalPrice} onChangeText={setFinalPrice} keyboardType="numeric" placeholder="e.g. 5000" placeholderTextColor={colors.textMuted} />
              </View>
              
              <View style={s.rowInputs}>
                <View style={[s.inputGroup, { flex: 1, marginRight: spacing['3'] }]}>
                  <Text style={s.label}>Teacher (₹)</Text>
                  <TextInput style={s.input} value={teacherPrice} onChangeText={setTeacherPrice} keyboardType="numeric" placeholder="e.g. 4000" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={[s.inputGroup, { flex: 1, marginLeft: spacing['3'] }]}>
                  <Text style={s.label}>Admin (₹)</Text>
                  <TextInput style={s.input} value={adminHourlyFee} onChangeText={setAdminHourlyFee} keyboardType="numeric" placeholder="e.g. 1000" placeholderTextColor={colors.textMuted} />
                </View>
              </View>
              
              <View style={s.inputGroup}>
                <Text style={s.label}>Admin Comment (Optional)</Text>
                <TextInput style={[s.input, s.textArea]} value={adminComment} onChangeText={setAdminComment} multiline placeholder="Leave a note for the tutor..." placeholderTextColor={colors.textMuted} />
              </View>
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.btn, s.btnCancel]} onPress={() => setShowModal(false)} disabled={submitting}>
                <Text style={s.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnSubmit]} onPress={handleApprove} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnSubmitText}>Approve & Publish</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing['4'], paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + spacing['4'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text, marginBottom: spacing['6'], paddingLeft: spacing['2'] },
  
  // Empty State
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyIcon: { fontSize: 60, marginBottom: spacing['4'] },
  emptyText: { color: colors.text, fontSize: typography.size.xl, fontWeight: typography.weight.bold, marginBottom: spacing['2'] },
  emptySubText: { color: colors.textSecondary, fontSize: typography.size.md },
  
  // Card Styles
  card: { backgroundColor: colors.card, padding: spacing['6'], borderRadius: radius.lg, marginBottom: spacing['6'], elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] },
  badge: { backgroundColor: colors.primary + '15', paddingHorizontal: spacing['3'], paddingVertical: 4, borderRadius: radius.full },
  badgeText: { color: colors.primary, fontSize: typography.size.xs, fontWeight: typography.weight.bold, textTransform: 'uppercase' },
  durationText: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  courseTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['4'], lineHeight: 28 },
  
  // Tutor Info
  tutorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['4'] },
  tutorAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing['3'] },
  tutorInitial: { color: colors.white, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  courseSubtitle: { fontSize: typography.size.md, color: colors.textSecondary, fontWeight: typography.weight.medium },
  
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing['3'] },
  
  // Details & Actions
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['2'] },
  priceBox: { flex: 1 },
  priceLabel: { fontSize: typography.size.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  priceValue: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.primary },
  
  approveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['6'], paddingVertical: spacing['4'], borderRadius: radius.full, elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  approveBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', maxHeight: '90%', backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing['8'], paddingBottom: Platform.OS === 'ios' ? 40 : spacing['8'] },
  modalHeader: { marginBottom: spacing['8'], alignItems: 'center' },
  modalTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: typography.size.md, color: colors.primary, fontWeight: typography.weight.semibold },
  
  // Form Styles
  inputGroup: { marginBottom: spacing['6'] },
  rowInputs: { flexDirection: 'row', width: '100%' },
  label: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['2'], fontWeight: typography.weight.semibold, marginLeft: 4 },
  input: { width: '100%', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing['4'], paddingVertical: Platform.OS === 'ios' ? spacing['4'] : spacing['3'], fontSize: typography.size.md, color: colors.text },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: spacing['4'] },
  
  // Modal Actions
  modalActions: { flexDirection: 'row', width: '100%', marginTop: spacing['4'], paddingTop: spacing['4'], borderTopWidth: 1, borderTopColor: colors.border },
  btn: { flex: 1, paddingVertical: spacing['4'], borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: 'transparent', marginRight: spacing['3'] },
  btnCancelText: { color: colors.textSecondary, fontWeight: typography.weight.bold, fontSize: typography.size.md },
  btnSubmit: { backgroundColor: colors.success, marginLeft: spacing['3'], elevation: 2, shadowColor: colors.success, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  btnSubmitText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.md }
});

export default AdminCourses;
