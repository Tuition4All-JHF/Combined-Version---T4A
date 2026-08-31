import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import apiClient from '../api/client';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useFocusEffect } from '@react-navigation/native';

const ChatList = ({ navigation }: any) => {
  const { colors } = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = () => {
    apiClient.get('chat/rooms/')
      .then(res => setRooms(res.data))
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  };

  useFocusEffect(useCallback(() => { fetchRooms(); }, []));

  const getOtherName = (room: any) =>
    user?.role === 'TUTOR' ? room.client_name : room.tutor_name;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString();
  };

  const s = createStyles(colors);

  return (
    <View style={s.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Messages</Text>
          {rooms.length > 0 && (
            <Text style={s.headerSub}>{rooms.length} conversation{rooms.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} size="large" />
      ) : rooms.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptyText}>
            {user?.role === 'STUDENT'
              ? 'Book a tutor to start chatting!'
              : 'Students you teach will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const otherName = getOtherName(item);
            const initial = otherName?.[0]?.toUpperCase() || '?';
            const hasLastMsg = !!item.last_message;
            const lastMsgTime = hasLastMsg ? formatTime(item.last_message.created_at) : '';
            const preview = item.last_message?.content || 'Start a conversation...';

            return (
              <TouchableOpacity
                style={s.roomCard}
                onPress={() => navigation.navigate('ChatScreen', { room: item, otherName })}
                activeOpacity={0.8}
              >
                {/* Avatar */}
                <View style={s.avatarRing}>
                  {(user?.role === 'STUDENT' || user?.role === 'PARENT') && item.tutor_photo ? (
                    <Image
                      source={{ uri: item.tutor_photo }}
                      style={s.avatarImage}
                    />
                  ) : (
                    <Text style={s.avatarText}>{initial}</Text>
                  )}
                </View>

                {/* Info */}
                <View style={s.roomInfo}>
                  <View style={s.roomTop}>
                    <Text style={s.roomName}>{otherName}</Text>
                    {lastMsgTime ? (
                      <Text style={s.timeText}>{lastMsgTime}</Text>
                    ) : null}
                  </View>
                  <Text style={s.lastMsg} numberOfLines={1}>
                    {preview}
                  </Text>
                </View>

                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={s.separator} />
          )}
        />
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: typography.weight.bold },
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
  },
  headerSub: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  emptyBox: {
    alignItems: 'center', marginTop: 80, paddingHorizontal: spacing['8'],
  },
  emptyIcon: { fontSize: 60, marginBottom: spacing['3'] },
  emptyTitle: {
    fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold,
    color: colors.text, textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    marginTop: spacing['2'], textAlign: 'center',
  },

  listContent: { paddingVertical: spacing['2'] },

  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing['4'],
    backgroundColor: colors.surface,
    gap: spacing['3'],
  },

  avatarRing: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.primary + '50',
    overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52 },
  avatarText: {
    color: colors.primary, fontWeight: typography.weight.extrabold, fontSize: typography.size.xl,
  },

  roomInfo: { flex: 1 },
  roomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  roomName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  timeText: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  lastMsg: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  chevron: {
    fontSize: 22, color: colors.textMuted, fontWeight: typography.weight.bold,
  },

  separator: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginLeft: spacing['5'] + 52 + spacing['3'],
  },
});

export default ChatList;
