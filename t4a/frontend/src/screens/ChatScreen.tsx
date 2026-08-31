import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import apiClient from '../api/client';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

const ChatScreen = ({ route, navigation }: any) => {
  const { room, otherName } = route.params;
  const { colors } = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = () => {
    apiClient.get(`chat/rooms/${room.id}/messages/`)
      .then(res => {
        setMessages(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const sendMessage = () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    const tempMsg = {
      id: Date.now(),
      sender_name: user?.username,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    apiClient.post(`chat/rooms/${room.id}/messages/`, { content })
      .then(fetchMessages)
      .catch(() => {});
  };

  const isMe = (msg: any) => msg.sender_name === user?.username;
  const otherInitial = otherName?.[0]?.toUpperCase() || '?';

  const s = createStyles(colors);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.surfaceElevated} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerAvatar}>
            {(user?.role === 'STUDENT' || user?.role === 'PARENT') && room.tutor_photo ? (
              <Image source={{ uri: room.tutor_photo }} style={s.headerAvatarImage} />
            ) : (
              <Text style={s.headerAvatarText}>{otherInitial}</Text>
            )}
          </View>
          <View>
            <Text style={s.headerName}>{otherName}</Text>
            <View style={s.onlinePill}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>Online</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>👋</Text>
              <Text style={s.emptyText}>Start the conversation!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const me = isMe(item);
            const timeStr = new Date(item.created_at).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit',
            });
            return (
              <View style={[s.bubbleRow, me ? s.bubbleRowMe : s.bubbleRowThem]}>
                {!me && (
                  <View style={s.senderAvatar}>
                    <Text style={s.senderAvatarText}>{otherInitial}</Text>
                  </View>
                )}
                <View style={[s.bubble, me ? s.bubbleMe : s.bubbleThem]}>
                  <Text style={[s.bubbleText, me ? s.bubbleTextMe : s.bubbleTextThem]}>
                    {item.content}
                  </Text>
                  <Text style={[s.bubbleTime, me ? s.bubbleTimeMe : s.bubbleTimeThem]}>
                    {timeStr}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input Bar */}
      <View style={[s.inputBar, inputFocused && s.inputBarFocused]}>
        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
          activeOpacity={0.85}
        >
          <Text style={s.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing['10'],
    paddingBottom: spacing['4'],
    paddingHorizontal: spacing['4'],
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing['3'],
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  backText: { color: colors.text, fontSize: 20, fontWeight: typography.weight.bold },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing['3'] },
  headerAvatar: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.primary + '50',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: 44, height: 44 },
  headerAvatarText: {
    color: colors.primary, fontWeight: typography.weight.extrabold, fontSize: typography.size.xl,
  },
  headerName: {
    fontSize: typography.size.base, fontWeight: typography.weight.extrabold, color: colors.text,
  },
  onlinePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  onlineDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success,
  },
  onlineText: {
    fontSize: typography.size.xs, color: colors.success, fontWeight: typography.weight.medium,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageList: { padding: spacing['4'], paddingBottom: spacing['2'], gap: spacing['2'] },

  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 50, marginBottom: spacing['3'] },
  emptyText: { color: colors.textMuted, fontSize: typography.size.sm },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing['2'] },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },

  senderAvatar: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.accent + '25',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  senderAvatarText: { color: colors.accent, fontSize: typography.size.xs, fontWeight: typography.weight.extrabold },

  bubble: {
    maxWidth: '75%', borderRadius: radius.lg,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'] + 2,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  bubbleThem: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  bubbleText: { fontSize: typography.size.sm, lineHeight: typography.lineHeight.normal },
  bubbleTextMe: { color: colors.white },
  bubbleTextThem: { color: colors.text },
  bubbleTime: {
    fontSize: typography.size.xs, marginTop: 4, textAlign: 'right',
  },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)' },
  bubbleTimeThem: { color: colors.textMuted },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing['3'], gap: spacing['2'],
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1, borderColor: colors.border,
  },
  inputBarFocused: {
    borderTopColor: colors.primary + '60',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['2'] + 2,
    fontSize: typography.size.sm,
    maxHeight: 100,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  sendBtnDisabled: { backgroundColor: colors.textMuted, shadowOpacity: 0 },
  sendBtnText: { color: colors.white, fontSize: 16 },
});

export default ChatScreen;
