import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Animated, Linking, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { adminApi } from '../../api/adminApi';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { useVideoPlayer, VideoView } from 'expo-video';

// ──────────────── Circular Progress ──────────────────────────────
function CircularProgress({ percentage, size = 120, strokeWidth = 10, color }: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const animValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animValue, {
      toValue: percentage,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  // We use a simple visual with rotation-based arc approximation via View
  const pct = Math.min(100, Math.max(0, percentage));
  const { colors } = useTheme();

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth,
        borderColor: colors.border,
      }} />
      {/* Foreground arc using clip trick */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth,
        borderColor: 'transparent',
        borderTopColor: pct >= 25 ? color : 'transparent',
        borderRightColor: pct >= 50 ? color : 'transparent',
        borderBottomColor: pct >= 75 ? color : 'transparent',
        borderLeftColor: pct >= 1 ? color : 'transparent',
        transform: [{ rotate: '-45deg' }],
      }} />
      {/* Percentage text */}
      <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.extrabold, color }}>
        {pct.toFixed(0)}%
      </Text>
      <Text style={{ fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 }}>
        Attendance
      </Text>
    </View>
  );
}

// ──────────────── Section Card ────────────────────────────────────
function SectionCard({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={cardStyles(colors).section}>
      <Text style={cardStyles(colors).sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const cardStyles = (colors: any) => StyleSheet.create({
  section: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['4'],
    marginBottom: spacing['4'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing['3'],
  },
});

// ──────────────── Row Item (inline – for short values) ───────────
function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing['2'],
      paddingVertical: spacing['1'],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <Text style={{
        color: colors.textSecondary,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        width: 110,
        flexShrink: 0,
      }}>{label}</Text>
      <Text style={{
        color: colors.text,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        flex: 1,
        textAlign: 'right',
      }}>{value || '—'}</Text>
    </View>
  );
}

// ──────────────── Block Item (stacked – for long text) ────────────
function InfoBlock({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{
      marginBottom: spacing['3'],
      padding: spacing['3'],
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    }}>
      <Text style={{
        color: colors.primary,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.extrabold,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: spacing['2'],
      }}>{label}</Text>
      <Text style={{
        color: colors.text,
        fontSize: typography.size.sm,
        lineHeight: 20,
      }}>{value || '—'}</Text>
    </View>
  );
}

// ──────────────── Person Chip ─────────────────────────────────────
function PersonChip({ name, email, color, colors }: { name: string; email: string; color: string; colors: any }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: color + '18',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: color + '40',
      padding: spacing['3'],
      marginBottom: spacing['2'],
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: color + '30',
        justifyContent: 'center', alignItems: 'center',
        marginRight: spacing['3'],
      }}>
        <Text style={{ color, fontWeight: typography.weight.extrabold, fontSize: typography.size.base }}>
          {name[0]?.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: typography.weight.semibold, fontSize: typography.size.sm }}>{name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.size.xs }}>{email}</Text>
      </View>
    </View>
  );
}

// ──────────────── Payment Row ─────────────────────────────────────
function PaymentRow({ item, colors }: { item: any; colors: any }) {
  const statusColor = item.status === 'COMPLETED' ? colors.success
    : item.status === 'PENDING' ? colors.warning
    : colors.danger;

  return (
    <View style={{
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing['3'],
      marginBottom: spacing['2'],
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ color: colors.text, fontWeight: typography.weight.bold, fontSize: typography.size.sm }}>
          ₹{item.amount}
        </Text>
        <View style={{
          backgroundColor: statusColor + '20',
          borderRadius: radius.full,
          paddingHorizontal: spacing['2'],
          paddingVertical: 2,
          borderWidth: 1,
          borderColor: statusColor + '50',
        }}>
          <Text style={{ color: statusColor, fontSize: typography.size.xs, fontWeight: typography.weight.bold }}>
            {item.status}
          </Text>
        </View>
      </View>
      {item.tutor && (
        <Text style={{ color: colors.textSecondary, fontSize: typography.size.xs }}>
          Tutor: {item.tutor}  •  {item.subject}
        </Text>
      )}
      {item.student && (
        <Text style={{ color: colors.textSecondary, fontSize: typography.size.xs }}>
          Student: {item.student}  •  {item.subject}
        </Text>
      )}
      <Text style={{ color: colors.textMuted, fontSize: typography.size.xs, marginTop: 2 }}>
        {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        {item.transaction_id ? `  •  TXN: ${item.transaction_id}` : ''}
      </Text>
    </View>
  );
}

// ──────────────── TutorDetailView ─────────────────────────────────
function TutorDetailView({ profile, colors }: { profile: any; colors: any }) {
  const player = useVideoPlayer(profile.intro_video || '');
  return (
    <>
      {/* Avatar + name */}
      <View style={{ alignItems: 'center', marginBottom: spacing['5'] }}>
        <View style={{
          width: 96, height: 96, borderRadius: 48,
          borderWidth: 3, borderColor: colors.primary,
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: colors.primary + '20',
          marginBottom: spacing['3'],
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}>
          {profile.profile_photo ? (
            <Image source={{ uri: profile.profile_photo }} style={{ width: 90, height: 90, borderRadius: 45 }} />
          ) : (
            <Text style={{ color: colors.primary, fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold }}>
              {profile.username[0]?.toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={{ color: colors.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold }}>
          {profile.username}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.size.sm, marginTop: 2 }}>{profile.email}</Text>
        <View style={{
          marginTop: spacing['2'], flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap', justifyContent: 'center'
        }}>
          <BadgePill label={`⭐ ${profile.rating}`} color={colors.warning} />
          <BadgePill label={profile.verification_status} color={profile.verification_status === 'APPROVED' ? colors.success : colors.warning} />
          {profile.is_frozen && <BadgePill label="Frozen" color={colors.danger} />}
        </View>
      </View>

      {/* Intro Video */}
      {profile.intro_video ? (
        <SectionCard title="📹 Intro Video" colors={colors}>
          <View style={{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' }}>
            <VideoView player={player} allowsFullscreen style={{ width: '100%', height: 180 }} />
          </View>
        </SectionCard>
      ) : null}

      {/* Key Info */}
      <SectionCard title="📋 Profile Details" colors={colors}>
        <InfoRow label="Experience" value={`${profile.experience_years} years`} colors={colors} />
        <InfoRow label="Rating" value={`⭐ ${profile.rating}`} colors={colors} />
        {profile.bio ? <InfoBlock label="Bio" value={profile.bio} colors={colors} /> : null}
        {profile.qualifications ? <InfoBlock label="Qualifications" value={profile.qualifications} colors={colors} /> : null}
      </SectionCard>

      {/* Subjects */}
      {profile.subjects?.length > 0 && (
        <SectionCard title="📚 Subjects" colors={colors}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['2'] }}>
            {profile.subjects.map((s: any) => (
              <BadgePill key={s.id} label={`${s.name} (₹${s.hourly_rate}/hr, ${s.course_duration_hours}h)`} color={colors.primary} />
            ))}
          </View>
        </SectionCard>
      )}

      {/* Certificate */}
      {profile.certification && (
        <SectionCard title="🎓 Certificate" colors={colors}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            padding: spacing['3'],
            borderWidth: 1,
            borderColor: colors.success + '40',
          }}>
            <View style={{ flex: 1, marginRight: spacing['3'] }}>
              <Text style={{ color: colors.success, fontSize: typography.size.sm, fontWeight: typography.weight.bold }}>
                ✓ Certificate Uploaded
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: typography.size.xs, marginTop: 2 }} numberOfLines={1}>
                {profile.certification.split('/').pop()}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingHorizontal: spacing['4'],
                paddingVertical: spacing['2'],
              }}
              onPress={() => {
                Linking.openURL(profile.certification).catch(() =>
                  Alert.alert('Error', 'Could not open certificate file.')
                );
              }}
            >
              <Text style={{ color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.sm }}>Open</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>
      )}

      {/* Enrolled Students */}
      <SectionCard title={`👩‍🎓 Enrolled Students (${profile.enrolled_students?.length || 0})`} colors={colors}>
        {profile.enrolled_students?.length > 0 ? (
          profile.enrolled_students.map((st: any) => (
            <PersonChip key={st.id} name={st.username} email={st.email} color={colors.primary} colors={colors} />
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm }}>No enrolled students yet.</Text>
        )}
      </SectionCard>
    </>
  );
}

// ──────────────── StudentDetailView ───────────────────────────────
function StudentDetailView({ profile, colors }: { profile: any; colors: any }) {
  return (
    <>
      {/* Avatar + name */}
      <View style={{ alignItems: 'center', marginBottom: spacing['5'] }}>
        <View style={{
          width: 96, height: 96, borderRadius: 48,
          borderWidth: 3, borderColor: colors.accent || colors.primary,
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: (colors.accent || colors.primary) + '20',
          marginBottom: spacing['3'],
        }}>
          <Text style={{ color: colors.accent || colors.primary, fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold }}>
            {profile.username[0]?.toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: colors.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold }}>
          {profile.username}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.size.sm, marginTop: 2 }}>{profile.email}</Text>
        {profile.is_frozen && (
          <BadgePill label="Frozen" color={colors.danger} />
        )}
      </View>

      {/* Attendance Ring */}
      <SectionCard title="📊 Attendance Overview" colors={colors}>
        <View style={{ alignItems: 'center', paddingVertical: spacing['3'] }}>
          <CircularProgress
            percentage={profile.overall_attendance_percentage || 0}
            size={130}
            strokeWidth={12}
            color={profile.overall_attendance_percentage >= 75 ? colors.success : profile.overall_attendance_percentage >= 50 ? colors.warning : colors.danger}
          />
          <Text style={{ color: colors.textSecondary, fontSize: typography.size.sm, marginTop: spacing['3'] }}>
            Total Sessions: {profile.total_sessions}
          </Text>
        </View>
      </SectionCard>

      {/* Enrolled Tutors */}
      <SectionCard title={`👨‍🏫 Enrolled Tutors (${profile.enrolled_tutors?.length || 0})`} colors={colors}>
        {profile.enrolled_tutors?.length > 0 ? (
          profile.enrolled_tutors.map((t: any) => (
            <PersonChip key={t.id} name={t.username} email={t.email} color={colors.primary} colors={colors} />
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm }}>No enrolled tutors yet.</Text>
        )}
      </SectionCard>

      {/* Payment History */}
      <SectionCard title={`💳 Payment History (${profile.payment_history?.length || 0})`} colors={colors}>
        {profile.payment_history?.length > 0 ? (
          profile.payment_history.map((p: any) => (
            <PaymentRow key={p.id} item={p} colors={colors} />
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm }}>No payment records.</Text>
        )}
      </SectionCard>
    </>
  );
}

// ──────────────── ParentDetailView ────────────────────────────────
function ParentDetailView({ profile, colors }: { profile: any; colors: any }) {
  return (
    <>
      {/* Avatar + name */}
      <View style={{ alignItems: 'center', marginBottom: spacing['5'] }}>
        <View style={{
          width: 96, height: 96, borderRadius: 48,
          borderWidth: 3, borderColor: colors.success,
          justifyContent: 'center', alignItems: 'center',
          backgroundColor: colors.success + '20',
          marginBottom: spacing['3'],
        }}>
          <Text style={{ color: colors.success, fontSize: typography.size['4xl'], fontWeight: typography.weight.extrabold }}>
            {profile.username[0]?.toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: colors.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold }}>
          {profile.username}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.size.sm, marginTop: 2 }}>{profile.email}</Text>
        {profile.is_frozen && (
          <BadgePill label="Frozen" color={colors.danger} />
        )}
      </View>

      {/* Linked Students */}
      <SectionCard title={`👧 Linked Students (${profile.linked_students?.length || 0})`} colors={colors}>
        {profile.linked_students?.length > 0 ? (
          profile.linked_students.map((s: any) => (
            <PersonChip key={s.id} name={s.username} email={s.email} color={colors.success} colors={colors} />
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm }}>No linked students.</Text>
        )}
      </SectionCard>

      {/* Transaction History */}
      <SectionCard title={`💳 Transaction History (${profile.transaction_history?.length || 0})`} colors={colors}>
        {profile.transaction_history?.length > 0 ? (
          profile.transaction_history.map((p: any) => (
            <PaymentRow key={p.id} item={p} colors={colors} />
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: typography.size.sm }}>No transactions found.</Text>
        )}
      </SectionCard>
    </>
  );
}

// ──────────────── BadgePill Helper ────────────────────────────────
function BadgePill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{
      backgroundColor: color + '20',
      borderRadius: radius.full,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['1'],
      borderWidth: 1,
      borderColor: color + '50',
      marginTop: spacing['1'],
    }}>
      <Text style={{ color, fontSize: typography.size.xs, fontWeight: typography.weight.bold }}>{label}</Text>
    </View>
  );
}

// ──────────────── Main Screen ─────────────────────────────────────
export default function AdminProfileDetail() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { accountId } = route.params;
  const { colors } = useTheme();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getProfileDetail(accountId)
      .then(data => setProfile(data))
      .catch(() => setError('Failed to load profile. Please try again.'))
      .finally(() => setLoading(false));
  }, [accountId]);

  const getRoleLabel = () => {
    if (!profile) return '';
    switch (profile.role) {
      case 'TUTOR': return '🎓 Tutor Profile';
      case 'STUDENT': return '📖 Student Profile';
      case 'PARENT': return '👨‍👧 Parent Profile';
      default: return 'Profile';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: spacing['10'], paddingBottom: spacing['4'], paddingHorizontal: spacing['4'],
        backgroundColor: colors.surfaceElevated,
        borderBottomWidth: 1, borderColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing['2'] }}>
          <Text style={{ fontSize: 24, color: colors.text, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: typography.size.base, fontWeight: typography.weight.bold, color: colors.text, flex: 1, textAlign: 'center' }}>
          {getRoleLabel()}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing['3'] }}>Loading profile...</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['6'] }}>
          <Text style={{ color: colors.danger, textAlign: 'center', fontSize: typography.size.base }}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing['4'], paddingBottom: spacing['10'] }} showsVerticalScrollIndicator={false}>
          {profile?.role === 'TUTOR' && <TutorDetailView profile={profile} colors={colors} />}
          {profile?.role === 'STUDENT' && <StudentDetailView profile={profile} colors={colors} />}
          {profile?.role === 'PARENT' && <ParentDetailView profile={profile} colors={colors} />}
        </ScrollView>
      )}
    </View>
  );
}
