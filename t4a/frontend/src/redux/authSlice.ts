import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  } | null;
}

const initialState: AuthState = {
  token: null,
  isAuthenticated: false,
  isGuest: false,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ token: string; user: any }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isGuest = false;
    },
    skipAuth(state) {
      state.isGuest = true;
      state.isAuthenticated = false;
    },
    logout(state) {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isGuest = false;
    },
  },
});

export const { loginSuccess, logout, skipAuth } = authSlice.actions;
export default authSlice.reducer;
