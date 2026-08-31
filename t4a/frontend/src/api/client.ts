import axios from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/authSlice';

// Use local Wi-Fi IP (192.168.1.8) for physical devices on same network
const BASE_URL = 'http://192.168.1.14:8000/api/';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token to every request
apiClient.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 Unauthorized by logging out
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }
    return Promise.reject(error);
  },
);

export default apiClient;
