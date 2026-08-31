import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';

const StudentAssignmentsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Submission Form State
  const [showModal, setShowModal] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [studentNotes, setStudentNotes] = useState('');
  const [attachment, setAttachment] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchAssignments();
  }, []));

  const fetchAssignments = () => {
    apiClient.get('assignments/')
      .then(res => setAssignments(res.data))
      .catch(err => console.error("Error fetching assignments:", err))
      .finally(() => setLoading(false));
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachment(result.assets[0]);
      }
    } catch (err) {
      console.log('Error picking document:', err);
    }
  };

  const handleSubmit = async () => {
    if (!attachment) {
      Alert.alert('Validation', 'Please select a file to upload.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    if (studentNotes.trim()) formData.append('student_notes', studentNotes);

    if (attachment) {
      const fileType = attachment.mimeType || 'application/octet-stream';
      formData.append('file', {
        uri: attachment.uri,
        name: attachment.name || `submission_${Date.now()}`,
        type: fileType,
      } as any);
    }

    apiClient.post(`assignments/${selectedAssignmentId}/submit/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
      .then(res => {
        Alert.alert('Success', 'Assignment submitted successfully.');
        setShowModal(false);
        resetForm();
        fetchAssignments();
      })
      .catch(err => {
        console.error("Error submitting assignment", err.response?.data);
        Alert.alert('Error', 'Failed to submit assignment.');
      })
      .finally(() => setSubmitting(false));
  };

  const resetForm = () => {
    setStudentNotes('');
    setAttachment(null);
    setSelectedAssignmentId(null);
  };

  const openAttachment = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open attachment.'));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return colors.warning;
      case 'SUBMITTED': return colors.info;
      case 'COMPLETED': return colors.success;
      default: return colors.textMuted;
    }
  };

  const s = createStyles(colors);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Assignments</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing['10'] }} />
      ) : (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {assignments.length > 0 ? (
            assignments.map((item: any) => {
              const assignmentStatus = item.submission ? (item.submission.status || 'SUBMITTED').toUpperCase() : 'PENDING';
              return (
              <View key={item.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <View style={[s.statusBadge, { backgroundColor: getStatusColor(assignmentStatus) + '20' }]}>
                    <Text style={[s.statusText, { color: getStatusColor(assignmentStatus) }]}>{assignmentStatus}</Text>
                  </View>
                </View>
                <Text style={s.cardTutor}>Tutor: {item.tutor_name}</Text>
                
                {item.description ? (
                  <Text style={s.cardDesc}>{item.description}</Text>
                ) : null}

                <View style={s.dateRow}>
                  <Text style={s.dateText}>Assigned: {item.assigned_date}</Text>
                  <Text style={s.dateText}>Due: {item.due_date}</Text>
                </View>
                
                {item.attachment_url && (
                  <TouchableOpacity style={s.downloadBtn} onPress={() => openAttachment(item.attachment_url)}>
                    <Text style={s.downloadBtnText}>📎 View Assignment File</Text>
                  </TouchableOpacity>
                )}

                {(assignmentStatus === 'PENDING' || assignmentStatus === 'RESUBMIT') && (
                  <TouchableOpacity 
                    style={s.submitActionBtn}
                    onPress={() => {
                      setSelectedAssignmentId(item.id);
                      setShowModal(true);
                    }}
                  >
                    <Text style={s.submitActionBtnText}>Submit Work</Text>
                  </TouchableOpacity>
                )}

                {item.submission && (
                  <View style={s.submissionBox}>
                    <Text style={s.submissionTitle}>Your Submission</Text>
                    {item.submission.student_notes ? (
                      <Text style={s.submissionText}>{item.submission.student_notes}</Text>
                    ) : null}
                    {item.submission.attachment_url ? (
                      <TouchableOpacity onPress={() => openAttachment(item.submission.attachment_url)}>
                        <Text style={s.downloadBtnText}>📎 View Submitted File</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
              </View>
            )})
          ) : (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>You have no assignments.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Submit Assignment Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Submit Assignment</Text>
            
            <Text style={s.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={studentNotes}
              onChangeText={setStudentNotes}
              placeholder="Add any notes or description..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />

            <Text style={s.inputLabel}>Attachment</Text>
            <TouchableOpacity style={s.attachBtn} onPress={pickDocument}>
              <Text style={s.attachBtnText}>
                {attachment ? `📎 ${attachment.name}` : '📎 Select File (PDF, Doc, Image)'}
              </Text>
            </TouchableOpacity>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={s.submitBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated, padding: spacing['5'],
    paddingTop: spacing['10'], borderBottomWidth: 1, borderColor: colors.border
  },
  backBtn: { padding: spacing['2'] },
  backBtnText: { fontSize: typography.size['2xl'], color: colors.text },
  headerTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },
  scrollContent: { padding: spacing['4'] },
  
  card: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], marginBottom: spacing['4'],
    borderWidth: 1, borderColor: colors.border
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: spacing['2'], paddingVertical: spacing['1'], borderRadius: radius.sm },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  cardTutor: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['1'] },
  cardDesc: { fontSize: typography.size.sm, color: colors.text, marginTop: spacing['3'] },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['3'], marginBottom: spacing['2'] },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted },
  
  downloadBtn: { marginTop: spacing['2'] },
  downloadBtnText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  
  submitActionBtn: {
    backgroundColor: colors.primary, padding: spacing['3'], borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing['4']
  },
  submitActionBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },

  submissionBox: {
    backgroundColor: colors.surface, padding: spacing['3'], borderRadius: radius.md,
    marginTop: spacing['4'], borderWidth: 1, borderColor: colors.borderSubtle
  },
  submissionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['2'] },
  submissionText: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['2'] },

  emptyBox: { alignItems: 'center', marginTop: spacing['10'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.base },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    padding: spacing['5']
  },
  modalTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['4'] },
  inputLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing['2'], marginTop: spacing['4'] },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing['3'], color: colors.text, backgroundColor: colors.surfaceElevated
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  attachBtn: { borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing['4'], alignItems: 'center' },
  attachBtnText: { color: colors.primary, fontWeight: typography.weight.medium },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['6'], marginBottom: spacing['4'] },
  cancelBtn: { padding: spacing['3'] },
  cancelBtnText: { color: colors.textSecondary, fontWeight: typography.weight.bold },
  submitBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['5'], paddingVertical: spacing['3'], borderRadius: radius.md },
  submitBtnText: { color: colors.white, fontWeight: typography.weight.bold },
});

export default StudentAssignmentsScreen;
