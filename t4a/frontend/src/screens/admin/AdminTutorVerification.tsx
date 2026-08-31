import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, StatusBar, Modal } from 'react-native';
import { adminApi } from '../../api/adminApi';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import AdminTutorProfileModal from '../../components/AdminTutorProfileModal';

export default function AdminTutorVerification({ navigation }: any) {
  const [tutors, setTutors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTutor, setSelectedTutor] = useState<{profileId: number, userId: number} | null>(null);

  const fetchTutors = async () => {
    try {
      const data = await adminApi.getPendingTutors();
      setTutors(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load tutors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutors();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTutors();
    });
    return unsubscribe;
  }, [navigation]);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>Fetching applications...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surfaceElevated} />
      
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Tutor Verification</Text>
          {tutors.length === 0 ? (
            <Text style={s.headerSub}>No pending applications</Text>
          ) : (
            <Text style={s.headerSub}>{tutors.length} pending application{tutors.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <View style={s.pendingBadge}>
          <Text style={s.pendingBadgeText}>{tutors.length}</Text>
        </View>
      </View>

      <FlatList
        data={tutors}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🎉</Text>
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptyText}>No pending tutor applications at this time.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const photoUrl = item.profile_photo_url || item.profile_photo;

          return (
            <TouchableOpacity 
              style={s.card} 
              activeOpacity={0.8}
              onPress={() => setSelectedTutor({ profileId: item.id, userId: item.user_id })}
            >
              <View style={s.identityRow}>
                <View style={s.avatarContainer}>
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={s.avatarImage} />
                  ) : (
                    <View style={s.avatarFallback}>
                      <Text style={s.avatarText}>{item.username?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                  )}
                </View>

                <View style={s.identityInfo}>
                  <Text style={s.tutorName}>{item.username}</Text>
                  <Text style={s.tutorEmail}>{item.email}</Text>
                </View>
                <View style={s.newBadge}>
                  <Text style={s.newBadgeText}>PENDING</Text>
                </View>
                <Text style={s.arrowIcon}>›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={!!selectedTutor} animationType="slide" onRequestClose={() => setSelectedTutor(null)}>
        {selectedTutor && (
          <AdminTutorProfileModal 
            tutorUserId={selectedTutor.userId} 
            tutorProfileId={selectedTutor.profileId}
            onClose={() => {
              setSelectedTutor(null);
              fetchTutors();
            }} 
          />
        )}
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center', gap: spacing['3'],
  },
  loadingText: { color: colors.textSecondary, fontSize: typography.size.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color: colors.text },
  headerSub: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  pendingBadge: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.warning + '20',
    borderWidth: 2, borderColor: colors.warning + '50',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingBadgeText: { color: colors.warning, fontWeight: typography.weight.extrabold, fontSize: typography.size.base },

  listContent: { padding: spacing['4'], paddingBottom: spacing['8'], gap: spacing['4'] },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['5'] },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing['2'], textAlign: 'center' },

  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['3'] },
  avatarContainer: {
    width: 58, height: 58, borderRadius: radius.full,
    overflow: 'hidden', borderWidth: 2, borderColor: colors.primary + '50',
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarFallback: {
    flex: 1, backgroundColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: colors.primary, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
  identityInfo: { flex: 1 },
  tutorName: { fontSize: typography.size.lg, fontWeight: typography.weight.extrabold, color: colors.text },
  tutorEmail: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  newBadge: {
    backgroundColor: colors.warning + '20', borderRadius: radius.full,
    paddingHorizontal: spacing['2'] + 2, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.warning + '50',
    marginRight: 8,
  },
  newBadgeText: { color: colors.warning, fontSize: 9, fontWeight: typography.weight.extrabold, letterSpacing: 1 },
  arrowIcon: { fontSize: 24, color: colors.textMuted, fontWeight: 'bold' }
});
