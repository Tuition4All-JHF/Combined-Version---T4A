import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

const TutorAssignmentsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number[] | 'ALL'>('ALL');
  const [attachment, setAttachment] = useState<any>(null);

  const [assignedDate, setAssignedDate] = useState(new Date());
  const [showAssignedPicker, setShowAssignedPicker] = useState(false);

  const [dueDate, setDueDate] = useState(new Date());
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchAssignments();
    fetchStudents();
  }, []));

  const fetchAssignments = () => {
    apiClient.get('assignments/')
      .then(res => {
        setAssignments(res.data);
      })
      .catch(err => {
        console.error("Error fetching assignments:", err);
      })
      .finally(() => setLoading(false));
  };

  const fetchStudents = () => {
    apiClient.get('my-students/')
      .then(res => setStudents(res.data))
      .catch(err => console.error("Error fetching students:", err));
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

  const toggleStudentSelection = (studentId: number) => {
    if (selectedStudent === 'ALL') {
      setSelectedStudent([studentId]);
    } else {
      let updated: number[];
      if (selectedStudent.includes(studentId)) {
        updated = selectedStudent.filter(id => id !== studentId);
      } else {
        updated = [...selectedStudent, studentId];
      }
      if (updated.length === 0) {
        setSelectedStudent('ALL');
      } else {
        setSelectedStudent(updated);
      }
    }
  };

  const selectAllStudents = () => {
    setSelectedStudent('ALL');
  };

  const handleCreateAssignment = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter an assignment title.');
      return;
    }

    if (Array.isArray(selectedStudent) && selectedStudent.length === 0) {
      Alert.alert('Validation', 'Please select at least one student.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);

    const studentValue = selectedStudent === 'ALL' ? 'ALL' : selectedStudent.join(',');
    formData.append('student', studentValue);
    formData.append('assigned_date', assignedDate.toISOString().split('T')[0]);
    formData.append('due_date', dueDate.toISOString().split('T')[0]);

    if (attachment) {
      const fileType = attachment.mimeType || 'application/octet-stream';
      formData.append('file', {
        uri: attachment.uri,
        name: attachment.name || `attachment_${Date.now()}`,
        type: fileType,
      } as any);
    }

    apiClient.post('assignments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
      .then(res => {
        Alert.alert('Success', 'Assignment created successfully.');
        setShowModal(false);
        resetForm();
        fetchAssignments();
      })
      .catch(err => {
        const detail = err.response?.data?.detail || '';
        if (detail.toLowerCase().includes('no students')) {
          Alert.alert('Notice', 'You currently have no students.');
        } else {
          Alert.alert('Error', detail || 'Failed to create assignment.');
        }
      })
      .finally(() => setSubmitting(false));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedStudent('ALL');
    setAttachment(null);
    setAssignedDate(new Date());
    setDueDate(new Date());
  };

  const markCompleted = (assignmentId: number) => {
    Alert.alert('Confirm', 'Mark this assignment as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          apiClient.patch(`assignments/${assignmentId}/`, { status: 'COMPLETED' })
            .then(() => {
              fetchAssignments();
            })
            .catch(err => {
              console.error(err);
              Alert.alert('Error', 'Could not update status');
            });
        }
      }
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return colors.warning;
      case 'SUBMITTED': return colors.info;
      case 'ACCEPTED': return colors.success;
      case 'COMPLETED': return colors.success;
      default: return colors.textMuted;
    }
  };

  const isStudentSelected = (studentId: number) => {
    if (selectedStudent === 'ALL') return false;
    return selectedStudent.includes(studentId);
  };

  const getSelectedSummary = () => {
    if (selectedStudent === 'ALL') {
      return 'Assigning to: All Students';
    }
    if (selectedStudent.length === 1) {
      const stu = students.find(sItem => sItem.id === selectedStudent[0]);
      return `Assigning to: ${stu?.username || '1 student'}`;
    }
    return `Assigning to: ${selectedStudent.length} selected students`;
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => {
          if (students.length === 0) {
            Alert.alert('Notice', 'You currently have no students.');
            return;
          }
          setShowModal(true);
        }}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing['10'] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {assignments.length > 0 ? (
            assignments.map((item: any) => {
              const assignmentStatus = item.submission ? (item.submission.status || 'SUBMITTED').toUpperCase() : 'PENDING';
              return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(assignmentStatus) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(assignmentStatus) }]}>{assignmentStatus}</Text>
                  </View>
                </View>
                <View style={styles.studentBadgeRow}>
                  <Text style={styles.studentBadgeLabel}>👤 Student:</Text>
                  <Text style={styles.cardStudent}>{item.student_name || 'All'}</Text>
                </View>

                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
                ) : null}

                <View style={styles.dateRow}>
                  <Text style={styles.dateText}>📅 Assigned: {item.assigned_date}</Text>
                  <Text style={styles.dateText}>⏳ Due: {item.due_date}</Text>
                </View>

                {item.attachment_url && (
                  <TouchableOpacity onPress={() => Linking.openURL(item.attachment_url)}>
                    <Text style={styles.attachmentLink}>📎 View Assignment File</Text>
                  </TouchableOpacity>
                )}

                {item.submission && (
                  <View style={styles.submissionBox}>
                    <Text style={styles.submissionTitle}>Student Submission:</Text>
                    {item.submission.student_notes ? (
                      <Text style={styles.submissionText}>{item.submission.student_notes}</Text>
                    ) : null}
                    {item.submission.attachment_url ? (
                      <TouchableOpacity
                        style={{ marginTop: spacing['2'] }}
                        onPress={() => Linking.openURL(item.submission.attachment_url).catch(() => Alert.alert('Error', 'Could not open file.'))}
                      >
                        <Text style={styles.attachmentLink}>📎 Open Student Attachment</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {assignmentStatus === 'SUBMITTED' && (
                  <TouchableOpacity style={styles.completeBtn} onPress={() => markCompleted(item.id)}>
                    <Text style={styles.completeBtnText}>Mark as Completed</Text>
                  </TouchableOpacity>
                )}
              </View>
            )})
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No assignments created yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Create Assignment Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>New Assignment</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="E.g. Math Homework 1"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.studentHeaderRow}>
                <Text style={styles.inputLabel}>Select Student(s) *</Text>
                <Text style={styles.summaryText}>{getSelectedSummary()}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.studentScrollContainer}
              >
                <TouchableOpacity
                  style={[styles.studentPill, selectedStudent === 'ALL' && styles.studentPillSelected]}
                  onPress={selectAllStudents}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.studentPillText, selectedStudent === 'ALL' && styles.studentPillTextSelected]}>
                    {selectedStudent === 'ALL' ? '✓ All Students' : 'All Students'}
                  </Text>
                </TouchableOpacity>

                {students.map(stu => {
                  const selected = isStudentSelected(stu.id);
                  return (
                    <TouchableOpacity
                      key={stu.id}
                      style={[styles.studentPill, selected && styles.studentPillSelected]}
                      onPress={() => toggleStudentSelection(stu.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.studentPillText, selected && styles.studentPillTextSelected]}>
                        {selected ? `✓ ${stu.username}` : stu.username}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter assignment instructions or details..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Schedule Dates</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowAssignedPicker(true)}>
                  <Text style={styles.dateBtnLabel}>Assigned Date</Text>
                  <Text style={styles.dateBtnValue}>{assignedDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDuePicker(true)}>
                  <Text style={styles.dateBtnLabel}>Due Date</Text>
                  <Text style={styles.dateBtnValue}>{dueDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>

              {showAssignedPicker && (
                <DateTimePicker
                  value={assignedDate}
                  mode="date"
                  display="default"
                  onChange={(event: any, date) => {
                    setShowAssignedPicker(false);
                    if (date) setAssignedDate(date);
                  }}
                />
              )}
              {showDuePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={(event: any, date) => {
                    setShowDuePicker(false);
                    if (date) setDueDate(date);
                  }}
                />
              )}

              <Text style={styles.inputLabel}>Attachment (Optional)</Text>
              <TouchableOpacity style={styles.attachBtn} onPress={pickDocument}>
                <Text style={styles.attachBtnText}>
                  {attachment ? `📎 ${attachment.name}` : '📎 Pick a file (PDF, Doc, Image)'}
                </Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowModal(false); resetForm(); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateAssignment} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Create Assignment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.md },
  addBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  scrollContent: { padding: spacing['4'] },

  card: {
    backgroundColor: colors.surfaceElevated, borderRadius: radius.lg,
    padding: spacing['4'], marginBottom: spacing['4'],
    borderWidth: 1, borderColor: colors.border
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing['2'] },
  cardTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: spacing['2'] + 2, paddingVertical: spacing['1'], borderRadius: radius.sm },
  statusText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  studentBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'], marginTop: spacing['1'] },
  studentBadgeLabel: { fontSize: typography.size.xs, color: colors.textMuted },
  cardStudent: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primary },
  cardDesc: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['2'], lineHeight: 20 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing['3'] },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted },
  attachmentLink: { fontSize: typography.size.sm, color: colors.primary, fontWeight: typography.weight.semibold, marginTop: spacing['2'], textDecorationLine: 'underline' },

  submissionBox: {
    backgroundColor: colors.surface, padding: spacing['3'], borderRadius: radius.md,
    marginTop: spacing['3'], borderWidth: 1, borderColor: colors.borderSubtle
  },
  submissionTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing['1'] },
  submissionText: { fontSize: typography.size.sm, color: colors.textSecondary },
  completeBtn: {
    backgroundColor: colors.success, padding: spacing['3'], borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing['3']
  },
  completeBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },

  emptyBox: { alignItems: 'center', marginTop: spacing['10'] },
  emptyIcon: { fontSize: 40, marginBottom: spacing['2'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.base },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    padding: spacing['5'], maxHeight: '90%'
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] },
  modalTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text },
  closeModalBtnText: { fontSize: typography.size.xl, color: colors.textMuted, padding: spacing['2'] },
  studentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['3'] },
  inputLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text, marginTop: spacing['3'], marginBottom: spacing['1'] },
  summaryText: { fontSize: typography.size.xs, color: colors.primary, fontWeight: typography.weight.medium },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing['3'], color: colors.text, backgroundColor: colors.surfaceElevated,
    fontSize: typography.size.sm
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  studentScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['2'],
    gap: spacing['2'],
  },
  studentPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'],
    backgroundColor: colors.surfaceElevated,
  },
  studentPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  studentPillText: {
    color: colors.text,
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.medium,
  },
  studentPillTextSelected: {
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  datePickerRow: { flexDirection: 'row', gap: spacing['3'], marginTop: spacing['1'] },
  dateBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing['3'], backgroundColor: colors.surfaceElevated },
  dateBtnLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: spacing['1'] },
  dateBtnValue: { fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.medium },
  attachBtn: { borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing['4'], alignItems: 'center', marginTop: spacing['1'] },
  attachBtnText: { color: colors.primary, fontWeight: typography.weight.medium },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing['3'], marginTop: spacing['6'], marginBottom: spacing['4'] },
  cancelBtn: { padding: spacing['3'] },
  cancelBtnText: { color: colors.textSecondary, fontWeight: typography.weight.bold },
  submitBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['5'], paddingVertical: spacing['3'], borderRadius: radius.md },
  submitBtnText: { color: colors.white, fontWeight: typography.weight.bold },
});

export default TutorAssignmentsScreen;
