import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import {
  getSessions,
  createSession,
  getSessionDetails,
  sendMessage,
  deleteSession,
} from '../../api/aiChat';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

export default function AIChatScreen({ navigation }: any) {
  const { colors } = useTheme();

  // State
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isFetchingSession, setIsFetchingSession] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Drawer Animation
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      fetchSessionDetails(currentSessionId);
    }
  }, [currentSessionId]);

  const fetchSessions = async () => {
    setIsFetchingSession(true);
    setFetchError(null);
    try {
      const data = await getSessions();
      setSessions(data);
      if (data.length > 0 && !currentSessionId) {
        setCurrentSessionId(data[0].id);
      } else if (data.length === 0) {
        // Auto-create a first session so the screen is never blank
        const newSession = await createSession();
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
      }
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      setFetchError('Cannot reach the server. Make sure the backend is running and you are on the same network.');
    } finally {
      setIsFetchingSession(false);
    }
  };

  const fetchSessionDetails = async (id: number) => {
    try {
      const data = await getSessionDetails(id);
      setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };

  const handleNewChat = async () => {
    try {
      const newSession = await createSession();
      setSessions([newSession, ...sessions]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      closeDrawer();
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentSessionId) return;

    const userMessage = { id: Date.now(), role: 'user', content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await sendMessage(currentSessionId, userMessage.content);
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: response.role, content: response.content }]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Optional: Add a UI error message here
    } finally {
      setIsLoading(false);
      fetchSessions(); // Refresh to get updated title
    }
  };

  // Voice recording placeholder (expo-av removed for compatibility)
  const startRecording = async () => {
    Alert.alert('Voice Input', 'Voice input requires a device rebuild. Please type your question instead.');
  };

  const stopRecording = async () => {
    setIsRecording(false);
  };

  // Drawer Controls
  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsDrawerOpen(false);
    });
  };

  const handleDeleteSession = (id: number) => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteSession(id);
            if (currentSessionId === id) {
              setCurrentSessionId(null);
              setMessages([]);
            }
            fetchSessions();
          } catch (error) {
            console.error('Error deleting session:', error);
          }
        }
      }
    ]);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx < -20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          closeDrawer();
        }
      },
    })
  ).current;

  const renderMessage = ({ item }: { item: any }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? { backgroundColor: colors.primary, alignSelf: 'flex-end' } : { backgroundColor: colors.surface, alignSelf: 'flex-start' }]}>
        <Text style={[styles.messageText, isUser ? { color: '#fff' } : { color: colors.text }]}>{item.content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuIcon}>
          <Feather name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tuition4All AI Assistant</Text>
      </View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView style={styles.chatArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {isFetchingSession ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.textSecondary }}>Connecting to AI...</Text>
          </View>
        ) : fetchError ? (
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <Feather name="wifi-off" size={48} color={colors.textSecondary} />
            <Text style={{ marginTop: 16, color: colors.text, fontWeight: '600', fontSize: 16, textAlign: 'center' }}>Connection Error</Text>
            <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>{fetchError}</Text>
            <TouchableOpacity onPress={fetchSessions} style={[styles.sendButton, { backgroundColor: colors.primary, marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, width: 'auto' }]}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {messages.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
                <Feather name="message-circle" size={48} color={colors.textSecondary} />
                <Text style={{ marginTop: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 }}>Ask me anything!</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={[...messages].reverse()}
                inverted={true}
                keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
              />
            )}
            {isLoading && (
              <View style={{ padding: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ marginLeft: 8, color: colors.textSecondary }}>AI is thinking...</Text>
              </View>
            )}
          </>
        )}

        <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPressOut={() => setIsRecording(false)}
            style={styles.micButton}>
            <Ionicons name="mic" size={22} color={isRecording ? 'red' : colors.text} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Type your question..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
            style={[styles.sendButton, { backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.disabled }]}>
            <Ionicons name="arrow-up" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>


      {/* Drawer */}
      {isDrawerOpen && (
        <TouchableOpacity style={styles.drawerOverlay} onPress={closeDrawer} activeOpacity={1} />
      )}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.drawer, { backgroundColor: colors.surface, transform: [{ translateX: drawerAnim }] }]}>
        <View style={styles.drawerHeader}>
          <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: colors.primary }]} onPress={handleNewChat}>
            <Feather name="plus" size={16} color="#FFF" />
            <Text style={styles.newChatText}>New Chat</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.sessionItem, currentSessionId === item.id && { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => {
                  setCurrentSessionId(item.id);
                  closeDrawer();
                }}>
                <Feather name="message-square" size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteSession(item.id)} style={{ padding: 8 }}>
                <Feather name="trash-2" size={16} color={colors.error || '#EF4444'} />
              </TouchableOpacity>
            </View>
          )}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
  },
  menuIcon: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  micButton: {
    padding: 10,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerHeader: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  newChatText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  sessionTitle: {
    fontSize: 16,
    flex: 1,
  },
});

