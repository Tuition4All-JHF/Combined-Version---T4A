import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  StatusBar, Modal, ActivityIndicator, BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import InCallManager from 'react-native-incall-manager';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import apiClient from '../api/client';

const LiveSessionScreen = ({ route, navigation }: any) => {
  const { roomId, isTutor, bookingIds = [], end_time, timeSlotId } = route.params;
  const classIdForWb = timeSlotId || bookingIds[0];
  const { user } = useSelector((state: RootState) => state.auth);

  const [sessionStarted, setSessionStarted] = useState(false);

  // Session Summary Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryAttachment, setSummaryAttachment] = useState<any>(null);
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);

  // Custom Whiteboard State
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Duration timer (counts seconds since session started)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedSecondsRef = useRef(0);

  const ws = useRef<WebSocket | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  // Track whether WebView has internal back history to suppress
  const webViewCanGoBack = useRef<boolean>(false);
  // Stable ref for back handler so it always sees latest state without re-registering
  const sessionStartedRef = useRef<boolean>(false);

  // Helper: keeps ref and state in sync
  const updateSessionStarted = (val: boolean) => {
    sessionStartedRef.current = val;
    setSessionStarted(val);
  };

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  // Format elapsed seconds → MM:SS or H:MM:SS
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Duration timer — starts counting as soon as session begins
  useEffect(() => {
    if (!sessionStarted) return;
    const timer = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionStarted]);

  // Android back button handler — registered once, uses refs to read latest state
  useEffect(() => {
    const onBackPress = () => {
      if (webViewCanGoBack.current) {
        // WebView has history; go back inside it but DO NOT exit the screen
        webViewRef.current?.goBack();
        return true;
      }
      const tutorAndActive = isTutor && sessionStartedRef.current;
      Alert.alert(
        'Leave Session?',
        tutorAndActive
          ? 'The session will still be active for students. Are you sure you want to leave?'
          : 'Are you sure you want to leave the class?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    InCallManager.start({ media: 'video', auto: false });
    InCallManager.setForceSpeakerphoneOn(true);
    connectSignaling();

    // Check if the session is already live on the server
    if (bookingIds && bookingIds.length > 0) {
      apiClient.get(`bookings/${bookingIds[0]}/`)
        .then((res: any) => {
          if (res.data && res.data.is_live) {
            updateSessionStarted(true);
          }
        })
        .catch((err: any) => {
          console.warn('[API] Error checking booking status:', err);
        });
    }

    // Meeting end time alert
    let alertTimeout: NodeJS.Timeout;
    if (end_time) {
      const endTime = new Date(end_time).getTime();
      const now = new Date().getTime();
      const timeRemaining = endTime - now;
      if (timeRemaining > 0) {
        alertTimeout = setTimeout(() => {
          const title = 'Session Ending';
          const message = isTutor
            ? 'The scheduled time for this session is almost ended'
            : "Warning: The scheduled duration for this class has ended.\n(Note: The class will only officially end when the Teacher Ends the session)";
          Alert.alert(title, message, [{ text: 'OK' }]);
        }, timeRemaining);
      }
    }

    return () => {
      if (alertTimeout) clearTimeout(alertTimeout);
      ws.current?.close();
      InCallManager.stop();
    };
  }, [end_time]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectSignaling = () => {
    const WS_BASE =
      apiClient.defaults.baseURL?.replace('http', 'ws').replace('/api/', '') ||
      'ws://10.0.2.2:8000';
    const wsUrl = `${WS_BASE}/ws/live/${roomId}/?username=${user?.username}`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'session_ended') {
          Alert.alert('Session Ended', 'The tutor has ended the session.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
          return;
        }

        if (data.type === 'session_started') {
          updateSessionStarted(true);
          if (data.elapsed_seconds !== undefined) {
            setElapsedSeconds(data.elapsed_seconds);
          }
          return;
        }

        // Keep a generic check for join/presence if needed
        if (data.type === 'join' && isTutor && sessionStartedRef.current) {
          ws.current?.send(JSON.stringify({ 
            type: 'session_started', 
            from: user?.username,
            elapsed_seconds: elapsedSecondsRef.current 
          }));
        }

        // --- MODERATOR RESTORATION ---
        // Student receives request from tutor to grant moderator
        if (data.type === 'request_moderator' && !isTutor) {
          const tutorName = data.tutor_username;
          // Inject JS: if student is currently moderator, grant owner to tutor participant
          const grantScript = `
            (function() {
              try {
                if (typeof APP !== 'undefined' && APP.store && APP.conference) {
                  var remoteParticipants = APP.store.getState()['features/base/participants'].remote;
                  var tutorId = null;
                  for (var id in remoteParticipants) {
                    if (remoteParticipants[id].name === '${tutorName}') {
                      tutorId = id;
                      break;
                    }
                  }
                  if (tutorId) {
                    APP.conference.grantOwner(tutorId);
                  }
                }
              } catch(e) {}
            })();
            true;
          `;
          webViewRef.current?.injectJavaScript(grantScript);
        }
      } catch (err) {
        console.warn('[WS] Message parse error:', err);
      }
    };

    socket.onopen = () => {
      setTimeout(() => {
        socket.send(JSON.stringify({ type: 'join', from: user?.username }));
      }, 300);
    };

    socket.onerror = (err) => {
      console.warn('[WS] Socket error:', err);
    };
  };

  const handleStartSession = async () => {
    try {
      await Promise.all(bookingIds.map((id: number) => apiClient.patch(`bookings/${id}/`, { is_live: true })));
      updateSessionStarted(true);
      ws.current?.send(JSON.stringify({ 
        type: 'session_started', 
        from: user?.username,
        elapsed_seconds: 0
      }));
    } catch (_) {
      Alert.alert('Error', 'Could not start session.');
    }
  };

  const handleEndSessionPress = () => {
    Alert.alert('End Session', 'Are you sure you want to end the session for all participants?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: async () => {
          try {
            await Promise.all(
              bookingIds.map((id: number) =>
                apiClient.patch(`bookings/${id}/`, { status: 'COMPLETED', is_live: false })
              )
            );
          } catch (_) { }
          ws.current?.send(JSON.stringify({ type: 'session_ended', from: user?.username }));
          setShowSummaryModal(true);
        },
      },
    ]);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.assets && result.assets.length > 0) {
        setSummaryAttachment(result.assets[0]);
      }
    } catch (err) {
      console.warn('Error picking document', err);
    }
  };

  const submitSummaryAndEnd = async () => {
    setIsSubmittingSummary(true);
    try {
      if (summaryText.trim() || summaryAttachment) {
        const formData = new FormData();
        const dateStr = new Date().toLocaleDateString();
        formData.append('title', `Class Summary - ${dateStr}`);
        formData.append('comments', summaryText);

        if (summaryAttachment) {
          formData.append('file', {
            uri: summaryAttachment.uri,
            name: summaryAttachment.name || 'attachment',
            type: summaryAttachment.mimeType || 'application/octet-stream',
          } as any);
        }

        await apiClient.post('study-notes/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setShowSummaryModal(false);
      navigation.goBack();
    } catch (err: any) {
      console.warn('Error uploading summary:', err.response?.data || err);
      Alert.alert('Error', 'Failed to upload session summary. Do you want to try again or skip?', [
        { text: 'Try Again', style: 'cancel', onPress: () => setIsSubmittingSummary(false) },
        {
          text: 'Skip', style: 'destructive', onPress: () => {
            setShowSummaryModal(false);
            navigation.goBack();
          }
        }
      ]);
    }
  };

  const skipSummaryAndEnd = () => {
    setShowSummaryModal(false);
    navigation.goBack();
  };

  // Base toolbar buttons for everyone
  let buttons = [
    'camera', 'chat', 'desktop', 'download', 'feedback', 'filmstrip', 'fullscreen',
    'microphone', 'participants-pane', 'profile', 'raisehand',
    'settings', 'shareaudio', 'stats', 'tileview', 'toggle-camera', 'videoquality',
    'whiteboard'
  ];
  if (isTutor) {
    buttons.push('hangup', 'mute-everyone', 'security');
  }
  const toolbarButtons = encodeURIComponent(JSON.stringify(buttons));

  const displayNameEncoded = encodeURIComponent(user?.username || 'Guest');
  const collabUrl = encodeURIComponent('https://excalidraw-backend.excalidraw.com');
  const disabledNotifs = encodeURIComponent(JSON.stringify(['notify.newDeviceAudioTitle', 'notify.newDeviceCameraTitle']));

  const jitsiUrl = `https://meet.element.io/${roomId}#userInfo.displayName="${displayNameEncoded}"` +
    `&config.disableDeepLinking=true` +
    `&config.prejoinPageEnabled=false` +
    `&config.prejoinConfig.enabled=false` +
    `&config.welcomePageEnabled=false` +
    `&config.p2p.enabled=false` +
    `&config.remoteVideoMenu.disableGrantModerator=true` +
    `&config.participantsPane.hideModeratorSettingsTab=true` +
    `&config.participantsPane.hideMoreActionsButton=true` +
    `&config.participantsPane.hideMuteAllButton=true` +
    `&config.toolbarButtons=${toolbarButtons}` +
    `&config.disabledNotifications=${disabledNotifs}` +
    `&interfaceConfig.SHOW_JITSI_WATERMARK=false` +
    `&config.startInTileView=true` +
    `&config.disableTileView=false` +
    `&config.disableDesktopSharing=false` +
    `&config.enableDesktopSharing=true` +
    `&config.whiteboard.enabled=true` +
    `&config.whiteboard.collabServerBaseUrl="${collabUrl}"` +
    `&config.disableModeratorIndicator=true` +
    `&config.remoteVideoMenu.disableKick=true` +
    `&config.remoteVideoMenu.disableGrantModerator=true` +
    `&config.participantsPane.hideModeratorSettingsTab=true` +
    `&config.participantsPane.hideMoreActionsButton=true` +
    `&config.participantsPane.hideMuteAllButton=true` +
    `&config.toolbarButtons=${toolbarButtons}` +
    `&interfaceConfig.SHOW_JITSI_WATERMARK=false` +
    `&interfaceConfig.SHOW_BRAND_WATERMARK=false` +
    `&interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false` +
    `&interfaceConfig.HIDE_INVITE_MORE_HEADER=true` +
    `&config.hideAddRoomButton=true` +
    `&config.disableInviteFunctions=true` +
    `&config.disableNotifications=true` +
    `&config.startWithAudioMuted=false` +
    `&config.startWithVideoMuted=false`;

  // Whether this client is the tutor (passed as string to injected JS)
  const isTutorStr = isTutor ? 'true' : 'false';
  // Tutor's expected username for verification logic
  const tutorUsername = isTutor ? user?.username : '';

  // The custom JS injected directly into Jitsi Meet iframe
  const INJECTED_JAVASCRIPT = `
    (function() {
      // Configuration
      var checkIntervalMs = 2000; 
      var maxRestorations = 10;
      var restorationCount = 0;

      window.addEventListener('load', function() {
        var isTutorClient = ${isTutorStr};
        var tutorDisplayName = '${tutorUsername}';

        // --- 1. Hide watermarks, notifications & branding via CSS ---
        var style = document.createElement('style');
        style.innerHTML = \`
          .watermark, #watermark, .leftwatermark, .rightwatermark, .poweredby,
          .chrome-extension-banner, .flogo-container, .watermark-container,
          #notifications-container, .notifications-container {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
          }
          video {
            object-fit: cover !important;
            width: 100% !important;
            height: 100% !important;
          }
          .videocontainer {
            background: transparent !important;
          }
          /* Fix camera: REMOVE Jitsi's built-in mirror transform on local video */
          .localVideoContainer video,
          .localVideoWrapper video,
          #localVideo,
          .mirrorVideo video,
          .mirrorVideo .videocontainer {
            transform: none !important;
            -webkit-transform: none !important;
          }
        \`;
        if (!isTutorClient) {
          // Hide moderator options for student (in case they joined first and got auto-promoted)
          style.innerHTML += \`
            div[aria-label*="End meeting"],
            li[aria-label*="End meeting"],
            div[aria-label*="Mute everyone"],
            .hangup-menu, 
            .participants-pane-context-menu {
               display: none !important;
            }
          \`;
        }
        document.head.appendChild(style);

        // --- Force Tile View on Load ---
        var enforceTileView = setInterval(() => {
            if (typeof APP !== 'undefined' && APP.store) {
                var state = APP.store.getState();
                if (state['features/video-layout'] && !state['features/video-layout'].tileViewEnabled) {
                    APP.store.dispatch({ type: 'SET_TILE_VIEW', enabled: true });
                } else if (state['features/video-layout'] && state['features/video-layout'].tileViewEnabled) {
                    clearInterval(enforceTileView);
                }
            } else if (typeof APP !== 'undefined' && APP.UI) {
                APP.UI.emitEvent('UI.tile_view_toggled', true);
            }
        }, 1000);
        setTimeout(() => clearInterval(enforceTileView), 10000); // Give up after 10s

        // --- 2. MutationObserver: ensure camera mirror is always removed ---
        var mirrorObserver = new MutationObserver(function() {
          // Remove mirror from any local video elements
          var localVideos = document.querySelectorAll(
            '.localVideoContainer video, .localVideoWrapper video, #localVideo'
          );
          localVideos.forEach(function(v) {
            v.style.transform = 'none';
            v.style.webkitTransform = 'none';
          });
          // Also remove mirror class effects from containers
          var mirrorContainers = document.querySelectorAll('.mirrorVideo');
          mirrorContainers.forEach(function(el) {
            el.style.transform = 'none';
            el.style.webkitTransform = 'none';
          });
        });
        mirrorObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

        // --- 3. Remove "Booking XXX" conference subject title from DOM ---
        var titleObserver = new MutationObserver(function() {
          var subjects = document.querySelectorAll('.subject, .subject-info, [class*="subject"]');
          subjects.forEach(function(el) { el.style.display = 'none'; });
          var roomName = document.querySelector('#subject');
          if (roomName) roomName.style.display = 'none';
          var confHeader = document.querySelector('.confbox .header, .conference-subject');
          if (confHeader) confHeader.style.display = 'none';
        });
        titleObserver.observe(document.body, { childList: true, subtree: true });

        // Check for "Join meeting" button on prejoin screen and click it automatically
        var autoJoinInterval = setInterval(function() {
            var joinBtn = document.querySelector('[data-testid="prejoin.joinMeeting"]') || 
                          document.querySelector('div[aria-label="Join meeting"]') ||
                          document.querySelector('.prejoin-preview-dropdown-btns .action-btn') ||
                          Array.from(document.querySelectorAll('div, button, span')).find(el => el.textContent.trim() === 'Join meeting' && el.offsetParent !== null);
            if (joinBtn) {
                joinBtn.click();
                clearInterval(autoJoinInterval);
            }
        }, 500);

        // --- 4. Block browser history (prevents WebView swallowing Android back press) ---
        window.history.pushState = function() {};
        window.history.replaceState = function() {};
        window.history.back = function() {};
        window.history.go = function() {};
        window.addEventListener('popstate', function(e) { e.stopImmediatePropagation(); }, true);

        // --- 5. Force tile view ---
        setTimeout(function() {
          try {
            if (typeof APP !== 'undefined' && APP.store) {
              APP.store.dispatch({ type: 'SET_TILE_VIEW', enabled: true });
            }
          } catch(e) {}
          try {
            var tileBtn = document.querySelector(
              '[data-testid="tileView"], button[aria-label*="tile"], button[aria-label*="Tile"]'
            );
            if (tileBtn) tileBtn.click();
          } catch(e) {}
        }, 2000);

        // --- 6. Moderator restoration (tutor side only) ---
        // Repeatedly check if tutor has lost moderator rights. If so, request it via RN bridge.
        if (isTutorClient) {
          setInterval(function() {
            try {
              if (typeof APP !== 'undefined' && APP.store) {
                var localUser = APP.store.getState()['features/base/participants'].local;
                if (localUser && localUser.role !== 'moderator') {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'request_moderator',
                    tutor_username: tutorDisplayName
                  }));
                }
              }
            } catch(e) {}
          }, 3000);
        }

        // --- 7. Force Video to Fill Screen (Remove Black Bars) ---
        var style = document.createElement('style');
        style.innerHTML = 'video { object-fit: cover !important; width: 100% !important; height: 100% !important; border-radius: 0 !important; } .videocontainer { background: transparent !important; }';
        document.head.appendChild(style);

      } catch(e) {
        console.warn('Jitsi inject error:', e);
      }
    })();
    true;
  `;

  // Calculate status bar height for header padding on Android
  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080810" translucent={false} />

      {/* Header — padded below status bar, elegant and accessible */}
      <View style={[styles.header, { paddingTop: statusBarOffset + 12 }]}>
        <View style={styles.headerLeft}>
          {isTutor && !sessionStarted && (
            <TouchableOpacity style={styles.startHeaderBtn} onPress={handleStartSession}>
              <Text style={styles.startHeaderBtnText}>Start</Text>
            </TouchableOpacity>
          )}
          {!isTutor && <Text style={styles.headerRole}>Student</Text>}
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.livePill}>
            <View style={styles.livePillDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
          <Text style={styles.headerTitle}>Live Class</Text>
          {/* Duration timer — shown once session is active */}
          {sessionStarted && (
            <Text style={styles.timerText}>⏱ {formatDuration(elapsedSeconds)}</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          {isTutor && sessionStarted && (
            <TouchableOpacity style={styles.endBtn} onPress={handleEndSessionPress}>
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          )}
          {!isTutor && (
            <TouchableOpacity style={styles.endBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.endBtnText}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {sessionStarted ? (
          <WebView
            ref={webViewRef}
            source={{ uri: jitsiUrl }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            mediaCapturePermissionGrantType="grant"
            originWhitelist={['*']}
              setBuiltInZoomControls={false}
              setDisplayZoomControls={false}
              bounces={false}
            onNavigationStateChange={(navState) => {
              webViewCanGoBack.current = navState.canGoBack ?? false;
              if (navState.url && !navState.url.includes(roomId)) {
                navigation.goBack();
              }
            }}
            onLoadEnd={() => {
              webViewRef.current?.injectJavaScript(INJECTED_JAVASCRIPT);
            }}
            onMessage={(e) => {
              // Handle messages posted from injected JS
              try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data.type === 'request_moderator' && isTutor) {
                  // Tutor detected they lost moderator — ask student via WS to grant it back
                  ws.current?.send(JSON.stringify({
                    type: 'request_moderator',
                    tutor_username: data.tutor_username,
                    from: user?.username,
                  }));
                }
              } catch (_) {}
            }}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingIcon}>{isTutor ? '👥' : '⏳'}</Text>
            <Text style={styles.waitingText}>
              {isTutor
                ? 'Ready to start the session? Click "Start" in the header to begin.'
                : 'Waiting for the tutor to start the class...'}
            </Text>
            <Text style={styles.waitingSubText}>
              Once a meeting begins, an end-to-end encrypted secure connection is established across our platform.
            </Text>
          </View>
        )}
      </View>

      {/* Custom Whiteboard Toggle */}
      {sessionStarted && (
        <TouchableOpacity 
          style={styles.whiteboardBtn} 
          onPress={() => setShowWhiteboard(true)}
        >
          <Text style={styles.whiteboardBtnText}>🎨 Whiteboard</Text>
        </TouchableOpacity>
      )}

      {/* Custom Whiteboard Modal */}
      <Modal visible={showWhiteboard} animationType="slide" onRequestClose={() => setShowWhiteboard(false)}>
        <View style={styles.wbHeader}>
          <TouchableOpacity onPress={() => setShowWhiteboard(false)} style={styles.wbCloseBtn}>
            <Text style={styles.wbCloseText}>📷 Back to Video</Text>
          </TouchableOpacity>
        </View>
        <WebView 
          source={{ uri: `${apiClient.defaults.baseURL?.replace('/api/', '')}/courses/live/${classIdForWb}/custom-whiteboard/?role=${isTutor ? 'teacher' : 'student'}&username=&student_id=${encodeURIComponent(user?.full_name || user?.username || 'Student')}` }}
          style={{ flex: 1 }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </Modal>

      {/* Summary Modal (Tutor Only) */}
      <Modal
        visible={showSummaryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Summary</Text>
            <Text style={styles.modalSub}>Provide a summary of the class. This will be available to students in their Study Notes.</Text>

            <Text style={styles.modalLabel}>Class Summary (Optional)</Text>
            <TextInput
              style={styles.summaryInput}
              multiline
              placeholder="e.g., We covered algebra equations today..."
              placeholderTextColor={colors.textMuted}
              value={summaryText}
              onChangeText={setSummaryText}
            />

            <Text style={styles.modalLabel}>Attachment (Optional)</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
              <Text style={styles.uploadBtnText}>
                {summaryAttachment ? '📎 ' + (summaryAttachment.name || 'File attached') : '📎 Pick a document (PDF, Doc)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSkipBtn}
                onPress={skipSummaryAndEnd}
                disabled={isSubmittingSummary}
              >
                <Text style={styles.modalSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSubmittingSummary && { opacity: 0.7 }]}
                onPress={submitSummaryAndEnd}
                disabled={isSubmittingSummary}
              >
                {isSubmittingSummary ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080810' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['4'],
    paddingBottom: spacing['2'],
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerLeft: { width: 72, justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 2, flex: 1 },
  headerRight: { width: 72, alignItems: 'flex-end', justifyContent: 'center' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.errorBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing['2'],
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  livePillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.error },
  livePillText: {
    color: colors.error,
    fontSize: 9,
    fontWeight: typography.weight.extrabold,
    letterSpacing: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extrabold,
  },
  timerText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  headerRole: { color: colors.textMuted, fontSize: typography.size.xs },
  startHeaderBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'] + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  startHeaderBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
  },
  whiteboardBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    zIndex: 99,
  },
  whiteboardBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  wbHeader: {
    height: 80,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingTop: Platform.OS === 'ios' ? 45 : 25,
  },
  wbCloseBtn: {
    padding: 10,
  },
  wbCloseText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  endBtn: {
    backgroundColor: colors.errorBg,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1'] + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error + '50',
  },
  endBtnText: { color: colors.error, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  content: { flex: 1, backgroundColor: '#0a0a12' },
  webView: { flex: 1 },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['6'],
  },
  waitingIcon: { fontSize: 48, marginBottom: spacing['4'] },
  waitingText: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  waitingSubText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing['2'],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing['4'],
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['5'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.extrabold,
    color: colors.text,
    marginBottom: spacing['2'],
  },
  modalSub: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing['5'],
    lineHeight: typography.lineHeight.relaxed,
  },
  modalLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing['2'],
  },
  summaryInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing['3'],
    color: colors.text,
    fontSize: typography.size.base,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing['4'],
  },
  uploadBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + '50',
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
    marginBottom: spacing['6'],
  },
  uploadBtnText: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing['3'],
  },
  modalSkipBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
  },
  modalSkipText: {
    color: colors.textSecondary,
    fontWeight: typography.weight.bold,
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    padding: spacing['4'],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalSubmitText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.base,
  },
});

export default LiveSessionScreen;
