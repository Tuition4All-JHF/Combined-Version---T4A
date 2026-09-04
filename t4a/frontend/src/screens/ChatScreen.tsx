import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, StatusBar, Modal, Dimensions
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import apiClient from '../api/client';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }: any) => {
  const { room, otherName } = route.params;
  const { colors } = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // State for Context Menu & Replies
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);

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

  const sendAttachment = async (uri: string, type: string) => {
    const formData = new FormData();
    if (text.trim()) formData.append('content', text.trim());
    if (replyTo) formData.append('reply_to', replyTo.id);
    
    formData.append('attachment', {
      uri,
      name: 'photo.jpg',
      type: 'image/jpeg'
    } as any);
    formData.append('attachment_type', type);
    
    setText('');
    setReplyTo(null);

    try {
      await apiClient.post(`chat/rooms/${room.id}/messages/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchMessages();
    } catch (e) {
      console.log('Upload error', e);
    }
  };

  const sendMessage = () => {
    const content = text.trim();
    if (!content) return;
    
    const formData = new FormData();
    formData.append('content', content);
    if (replyTo) formData.append('reply_to', replyTo.id);
    
    setText('');
    setReplyTo(null);

    apiClient.post(`chat/rooms/${room.id}/messages/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(fetchMessages).catch(() => {});
  };

  // Image Picker
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      sendAttachment(result.assets[0].uri, 'image');
    }
  };

  const handleReply = () => {
    setReplyTo(selectedMessage);
    setSelectedMessage(null);
  };

  const isMe = (msg: any) => msg.sender_name === user?.username;
  const otherInitial = otherName?.[0]?.toUpperCase() || '?';

  const renderMessage = ({ item }: { item: any }) => {
    const me = isMe(item);
    const timeStr = new Date(item.created_at).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit',
    });
    
    return (
      <TouchableOpacity 
        activeOpacity={0.9}
        onLongPress={() => setSelectedMessage(item)}
        style={[s.bubbleRow, me ? s.bubbleRowMe : s.bubbleRowThem]}
      >
        <View style={[s.bubble, me ? s.bubbleMe : s.bubbleThem]}>
          {item.reply_to_content && (
            <View style={[s.replyBoxInline, me ? s.replyBoxInlineMe : s.replyBoxInlineThem]}>
              <Text style={[s.replySenderInline, me ? s.replySenderInlineMe : s.replySenderInlineThem]}>{item.reply_to_sender}</Text>
              <Text style={[s.replyTextInline, me ? s.replyTextInlineMe : s.replyTextInlineThem]} numberOfLines={1}>{item.reply_to_content || 'Attachment'}</Text>
            </View>
          )}
          
          {item.attachment_type === 'image' && item.attachment_url && (
            <Image source={{ uri: item.attachment_url }} style={s.chatImage} />
          )}

          {!!item.content && (
            <Text selectable={true} style={[s.bubbleText, me ? s.bubbleTextMe : s.bubbleTextThem]}>
              {item.content}
            </Text>
          )}
          
          <Text style={[s.bubbleTime, me ? s.bubbleTimeMe : s.bubbleTimeThem]}>
            {timeStr}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const s = createStyles(colors);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Header (T4A iMessage Style) */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
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
            <Text style={s.onlineText}>Active Now</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <View style={s.chatBackground}>
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
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} style={{marginBottom: 10}} />
                <Text style={s.emptyText}>Send a message to start</Text>
              </View>
            }
            renderItem={renderMessage}
          />
        )}
      </View>

      {/* Reply Preview */}
      {replyTo && (
        <View style={s.replyPreview}>
          <View style={s.replyIconWrap}>
             <Ionicons name="arrow-undo" size={20} color={colors.primary} />
          </View>
          <View style={s.replyContent}>
            <Text style={s.replySenderPreview}>{replyTo.sender_name}</Text>
            <Text style={s.replyTextPreview} numberOfLines={1}>{replyTo.content || 'Attachment'}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={s.replyClose}>
            <Ionicons name="close-circle" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={s.inputContainerWrapper}>
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity onPress={pickImage} style={s.iconBtn}>
            <Ionicons name="image-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[s.micSendBtn, { opacity: text.trim() ? 1 : 0.6 }]} 
          onPress={sendMessage}
          disabled={!text.trim()}
        >
          <Ionicons name="arrow-up" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Context Menu Modal */}
      <Modal transparent visible={!!selectedMessage} animationType="slide">
        <TouchableOpacity style={s.modalOverlay} onPress={() => setSelectedMessage(null)} activeOpacity={1}>
          <View style={s.contextMenu}>
            <View style={s.contextDragHandle} />
            <Text style={s.contextHeader}>Message Actions</Text>
            <TouchableOpacity style={s.contextItem} onPress={handleReply}>
              <View style={s.contextIconWrap}>
                <Ionicons name="arrow-undo" size={22} color={colors.primary} />
              </View>
              <Text style={s.contextText}>Reply to Message</Text>
            </TouchableOpacity>
            
            {/* The user wants to copy text natively with selectable={true}, but we can leave a visual hint or just keep reply */}
            <View style={{height: 10}} />
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'ios' ? 55 : 35,
    paddingBottom: 15,
    paddingHorizontal: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2,
  },
  backBtn: { padding: 5, marginLeft: -5 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '20', // Very light primary tint
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: 44, height: 44 },
  headerAvatarText: { color: colors.primary, fontWeight: '700', fontSize: 18 },
  headerName: { fontSize: 18, fontWeight: '700', color: colors.text },
  onlineText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  chatBackground: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: 15, paddingBottom: 25, gap: 8 },
  emptyBox: { alignItems: 'center', marginTop: 100, opacity: 0.6 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '78%', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1
  },
  bubbleMe: { 
    backgroundColor: colors.primary, 
    borderRadius: 24,
    borderBottomRightRadius: 6, 
  },
  bubbleThem: { 
    backgroundColor: colors.surface, 
    borderRadius: 24,
    borderBottomLeftRadius: 6, 
    borderWidth: 1,
    borderColor: colors.border + '40'
  },
  
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMe: { color: '#FFF', fontWeight: '400' },
  bubbleTextThem: { color: colors.text, fontWeight: '400' },
  
  bubbleTime: { fontSize: 11, marginTop: 4, textAlign: 'right', alignSelf: 'flex-end', fontWeight: '600' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeThem: { color: colors.textMuted },

  chatImage: { width: 220, height: 220, borderRadius: 16, marginVertical: 4 },

  replyBoxInline: { 
    borderLeftWidth: 3, 
    padding: 8, 
    borderRadius: 8, 
    marginBottom: 8 
  },
  replyBoxInlineMe: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderLeftColor: '#FFF', 
  },
  replyBoxInlineThem: {
    backgroundColor: colors.background,
    borderLeftColor: colors.primary, 
  },
  replySenderInline: { fontWeight: 'bold', fontSize: 13, marginBottom: 2 },
  replySenderInlineMe: { color: '#FFF' },
  replySenderInlineThem: { color: colors.primary },
  
  replyTextInline: { fontSize: 13 },
  replyTextInlineMe: { color: 'rgba(255,255,255,0.9)' },
  replyTextInlineThem: { color: colors.textMuted },

  replyPreview: { 
    flexDirection: 'row', 
    backgroundColor: colors.surface, 
    padding: 12, 
    marginHorizontal: 15, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
    borderWidth: 1,
    borderColor: colors.border + '60'
  },
  replyIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  replyContent: { flex: 1 },
  replySenderPreview: { color: colors.primary, fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  replyTextPreview: { color: colors.textMuted, fontSize: 14 },
  replyClose: { padding: 5 },

  inputContainerWrapper: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    paddingHorizontal: 15, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 15, 
    paddingTop: 5,
    backgroundColor: colors.background, 
    gap: 10 
  },
  inputBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surface, 
    borderRadius: 26, 
    paddingLeft: 20, 
    paddingRight: 6, 
    minHeight: 52, 
    borderWidth: 1,
    borderColor: colors.border + '70',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1
  },
  iconBtn: { padding: 10 },
  input: { 
    flex: 1, 
    maxHeight: 120, 
    minHeight: 40, 
    fontSize: 16, 
    color: colors.text, 
    paddingTop: Platform.OS === 'ios' ? 14 : 12, 
    paddingBottom: Platform.OS === 'ios' ? 14 : 12 
  },
  
  micSendBtn: { 
    width: 48, height: 48, 
    borderRadius: 24, 
    backgroundColor: colors.primary, 
    justifyContent: 'center', alignItems: 'center', 
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4,
    marginBottom: 2
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  contextMenu: { 
    backgroundColor: colors.surface, 
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25, 
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 
  },
  contextDragHandle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  contextHeader: { fontSize: 15, color: colors.textMuted, fontWeight: '700', marginBottom: 15, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  contextItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 15 },
  contextIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  contextText: { fontSize: 17, color: colors.text, fontWeight: '600' }
});

export default ChatScreen;
