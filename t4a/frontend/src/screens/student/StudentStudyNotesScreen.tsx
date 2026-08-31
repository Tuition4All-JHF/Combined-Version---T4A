import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import apiClient from '../../api/client';
import { useFocusEffect } from '@react-navigation/native';

const StudentStudyNotesScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchNotes();
  }, []));

  const fetchNotes = () => {
    setLoading(true);
    apiClient.get('study-notes/')
      .then(res => setNotes(res.data))
      .catch(err => console.error("Error fetching notes:", err))
      .finally(() => setLoading(false));
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Notes</Text>
        <View style={{ width: 40 }} />
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
                </View>
                
                <View style={styles.tutorBadgeRow}>
                  <Text style={styles.tutorBadgeLabel}>👨‍🏫 From:</Text>
                  <Text style={styles.cardTutor}>{item.tutor_name}</Text>
                </View>

                {item.comments ? (
                  <Text style={styles.cardDesc}>{item.comments}</Text>
                ) : null}

                <Text style={styles.dateText}>📅 Uploaded: {new Date(item.created_at).toLocaleDateString()}</Text>
                
                {item.file_url && (
                  <TouchableOpacity 
                    style={styles.openBtn}
                    onPress={() => Linking.openURL(item.file_url)}
                  >
                    <Text style={styles.openBtnText}>Open File</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No study notes available.</Text>
            </View>
          )}
        </ScrollView>
      )}
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
  scrollContent: { padding: spacing['4'], paddingBottom: spacing['10'] },
  card: {
    backgroundColor: colors.surface, padding: spacing['4'], borderRadius: radius.lg,
    marginBottom: spacing['4'], borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing['2'] },
  cardTitle: { fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text, flex: 1 },
  tutorBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['3'] },
  tutorBadgeLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginRight: spacing['2'] },
  cardTutor: {
    fontSize: typography.size.xs, color: colors.primary, fontWeight: 'bold',
    backgroundColor: colors.primary + '20', paddingHorizontal: spacing['2'], paddingVertical: 2, borderRadius: radius.sm,
  },
  cardDesc: { fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing['3'] },
  dateText: { fontSize: typography.size.xs, color: colors.textMuted, marginBottom: spacing['3'] },
  openBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing['3'], borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing['2']
  },
  openBtnText: { color: colors.white, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: spacing['10'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.base },
});

export default StudentStudyNotesScreen;
