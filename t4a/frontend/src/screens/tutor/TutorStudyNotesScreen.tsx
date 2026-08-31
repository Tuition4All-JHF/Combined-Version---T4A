import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking, BackHandler,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';

const TutorStudyNotesScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [comments, setComments] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | 'ALL'>('ALL');
  const [attachment, setAttachment] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchNotes();
    fetchStudents();
  }, []));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showModal) {
        setShowModal(false);
        resetForm();
        return true; // consume the event
      }
      return false; // let it propagate (go back)
    });
    return () => sub.remove();
  }, [showModal]);

  const fetchNotes = () => {
    apiClient.get('study-notes/')
      .then(res => setNotes(res.data))
      .catch(err => console.error("Error fetching notes:", err))
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

  const handleUploadNote = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a title for the note.');
      return;
    }

    if (!attachment) {
      Alert.alert('Validation', 'Please select a file to upload.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('title', title);
    if (comments) formData.append('comments', comments);
    if (selectedStudent !== 'ALL') {
      formData.append('student', selectedStudent.toString());
    }

    const fileType = attachment.mimeType || 'application/octet-stream';
    formData.append('file', {
      uri: attachment.uri,
      name: attachment.name || `note_${Date.now()}`,
      type: fileType,
    } as any);

    apiClient.post('study-notes/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
      .then(res => {
        Alert.alert('Success', 'Study note uploaded successfully.');
        setShowModal(false);
        resetForm();
        fetchNotes();
      })
      .catch(err => {
        const detail = err.response?.data?.detail || '';
        if (detail.toLowerCase().includes('no students')) {
          Alert.alert('Notice', 'You currently have no students.');
        } else {
          Alert.alert('Error', detail || 'Failed to upload note.');
        }
      })
      .finally(() => setSubmitting(false));
  };

  const handleDeleteNote = (noteId: number) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          apiClient.delete(`study-notes/${noteId}/`)
            .then(() => fetchNotes())
            .catch(() => Alert.alert('Error', 'Could not delete note.'));
        }
      }
    ]);
  };

  const resetForm = () => {
    setTitle('');
    setComments('');
    setSelectedStudent('ALL');
    setAttachment(null);
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Notes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => {
          if (students.length === 0) {
            Alert.alert('Notice', 'You currently have no students.');
            return;
          }
          setShowModal(true);
        }}>
          <Text style={styles.addBtnText}>+ Upload</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing['10'] }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {notes.length > 0 ? (
            notes.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <TouchableOpacity onPress={() => handleDeleteNote(item.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.studentBadgeRow}>
                  <Text style={styles.studentBadgeLabel}>👥 Assigned to:</Text>
                  <Text style={styles.cardStudent}>{item.student_name || 'All Students'}</Text>
                </View>

                {item.comments ? (
                  <Text style={styles.cardDesc}>{item.comments}</Text>
                ) : null}

                <Text style={styles.dateText}>📅 Uploaded: {new Date(item.created_at).toLocaleDateString()}</Text>

                {item.file_url && (
                  <TouchableOpacity onPress={() => Linking.openURL(item.file_url)}>
                    <Text style={styles.attachmentLink}>📎 Open File</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No study notes uploaded yet.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Upload Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upload Study Note</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Algebra Formulas"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Comments (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add some context or instructions..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={comments}
                onChangeText={setComments}
              />

              <Text style={styles.label}>Assign To</Text>
              <View style={styles.studentsList}>
                <TouchableOpacity
                  style={[styles.studentChip, selectedStudent === 'ALL' && styles.studentChipActive]}
                  onPress={() => setSelectedStudent('ALL')}
                >
                  <Text style={[styles.studentChipText, selectedStudent === 'ALL' && styles.studentChipTextActive]}>
                    All Students
                  </Text>
                </TouchableOpacity>

                {students.map(stu => {
                  const isSel = selectedStudent === stu.id;
                  return (
                    <TouchableOpacity
                      key={stu.id}
                      style={[styles.studentChip, isSel && styles.studentChipActive]}
                      onPress={() => setSelectedStudent(stu.id)}
                    >
                      <Text style={[styles.studentChipText, isSel && styles.studentChipTextActive]}>
                        {stu.username}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>File Attachment</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
                <Text style={styles.uploadBtnText}>
                  {attachment ? attachment.name : 'Choose File (PDF, Image, Doc)'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowModal(false); resetForm(); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleUploadNote}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Upload Note</Text>
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
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['4'], paddingVertical: spacing['2'], borderRadius: radius.md },
  addBtnText: { color: colors.white, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  scrollContent: { padding: spacing['4'], paddingBottom: spacing['10'] },
  card: {
    backgroundColor: colors.surface, padding: spacing['4'], borderRadius: radius.lg,
    marginBottom: spacing['4'], borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing['2'] },
  cardTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text, flex: 1 },
  deleteText: { color: colors.error, fontSize: typography.size.sm, fontWeight: 'bold' },
  studentBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'] },
  studentBadgeLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginRight: spacing['2'] },
  cardStudent: {
    fontSize: typography.size.xs, color: colors.primary, fontWeight: 'bold',
    backgroundColor: colors.primary + '20', paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.sm,
  },
  cardDesc: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['3'] },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: spacing['2'] },
  attachmentLink: { color: colors.primary, fontWeight: 'bold', marginTop: spacing['2'] },
  emptyContainer: { alignItems: 'center', marginTop: spacing['10'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.base },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing['5'], maxHeight: '85%',
  },
  modalTitle: { fontSize: typography.size.xl, fontWeight: 'bold', color: colors.text, marginBottom: spacing['4'] },
  label: { fontSize: typography.size.sm, fontWeight: 'bold', color: colors.textSecondary, marginBottom: spacing['2'], marginTop: spacing['3'] },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing['3'], color: colors.text,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  studentsList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] },
  studentChip: {
    paddingHorizontal: spacing['3'], paddingVertical: spacing['2'],
    borderRadius: radius.full, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  studentChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  studentChipText: { color: colors.textSecondary, fontSize: typography.size.sm },
  studentChipTextActive: { color: colors.primary, fontWeight: 'bold' },
  uploadBtn: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md, padding: spacing['4'], alignItems: 'center', marginTop: spacing['2']
  },
  uploadBtnText: { color: colors.primary, fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing['3'], marginTop: spacing['6'] },
  cancelBtn: { paddingHorizontal: spacing['4'], paddingVertical: spacing['3'] },
  cancelBtnText: { color: colors.textMuted, fontWeight: 'bold' },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing['5'], paddingVertical: spacing['3'], borderRadius: radius.md },
  saveBtnText: { color: colors.white, fontWeight: 'bold' },
});

export default TutorStudyNotesScreen;
