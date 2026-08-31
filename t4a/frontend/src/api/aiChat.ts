import apiClient from './client';

// All requests use the shared apiClient which:
// - Points to the correct backend IP (192.168.1.25:8000)
// - Automatically attaches the JWT Bearer token from Redux
// - Handles 401 logout automatically

export const getSessions = async () => {
  const response = await apiClient.get('ai-chat/sessions/');
  return response.data;
};

export const createSession = async () => {
  const response = await apiClient.post('ai-chat/sessions/', {});
  return response.data;
};

export const getSessionDetails = async (sessionId: number) => {
  const response = await apiClient.get(`ai-chat/sessions/${sessionId}/`);
  return response.data;
};

export const deleteSession = async (sessionId: number) => {
  const response = await apiClient.delete(`ai-chat/sessions/${sessionId}/`);
  return response.data;
};

export const sendMessage = async (sessionId: number, content: string) => {
  const response = await apiClient.post(
    `ai-chat/sessions/${sessionId}/messages/`,
    { content }
  );
  return response.data;
};

export const transcribeAudio = async (audioUri: string) => {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'audio_message.m4a',
  } as any);

  const response = await apiClient.post('ai-chat/transcribe/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};
