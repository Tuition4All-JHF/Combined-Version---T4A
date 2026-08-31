// ============================================================
//  T4A — Tuition4All Design System · Theme Context
//  Provides dark/light mode to the entire app
// ============================================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Dark Colors ──────────────────────────────────────────────
export const darkColors = {
  primary:        '#6C63FF',
  primaryDark:    '#5B53EE',
  primaryDeep:    '#4A3FDD',
  accent:         '#8B5CF6',
  accentAlt:      '#A78BFA',
  background:     '#0D0E1A',
  surface:        '#13152A',
  surfaceElevated:'#1C1F3A',
  surfaceHigh:    '#252848',
  text:           '#F0F0FF',
  textSecondary:  '#8B8FA8',
  textMuted:      '#555779',
  textInverse:    '#0D0E1A',
  border:         'rgba(108,99,255,0.25)',
  borderSubtle:   'rgba(255,255,255,0.08)',
  borderGlow:     'rgba(108,99,255,0.6)',
  success:        '#10B981',
  successBg:      'rgba(16,185,129,0.15)',
  error:          '#F87171',
  errorBg:        'rgba(248,113,113,0.15)',
  warning:        '#FBBF24',
  warningBg:      'rgba(251,191,36,0.15)',
  info:           '#38BDF8',
  infoBg:         'rgba(56,189,248,0.15)',
  white:          '#FFFFFF',
  black:          '#000000',
  transparent:    'transparent',
  overlay:        'rgba(0,0,0,0.6)',
  overlayLight:   'rgba(13,14,26,0.8)',
  glassLight:     'rgba(255,255,255,0.05)',
  glassBorder:    'rgba(255,255,255,0.1)',
  statusPending:  '#FBBF24',
  statusConfirmed:'#10B981',
  statusCancelled:'#F87171',
  statusCompleted:'#8B5CF6',
  gradientPrimary: ['#6C63FF', '#8B5CF6'] as [string, string],
  gradientDark:    ['#0D0E1A', '#1a1040'] as [string, string],
  gradientCard:    ['#1C1F3A', '#13152A'] as [string, string],
  gradientAdmin:   ['#1a1040', '#0D0E1A'] as [string, string],
  secondary:      '#5B53EE',
};

// ── Light Colors (matches Tuition4All website) ────────────────
export const lightColors = {
  primary:        '#6B4EFF',
  primaryDark:    '#5B3EEF',
  primaryDeep:    '#4B2EDF',
  accent:         '#8B5CF6',
  accentAlt:      '#A78BFA',
  background:     '#FAFAFF',
  surface:        '#FFFFFF',
  surfaceElevated:'#FFFFFF',
  surfaceHigh:    '#F5F3FF',
  text:           '#1A1A2E',
  textSecondary:  '#4B5563',
  textMuted:      '#9CA3AF',
  textInverse:    '#FFFFFF',
  border:         '#E5E7EB',
  borderSubtle:   '#F3F4F6',
  borderGlow:     'rgba(107,78,255,0.5)',
  success:        '#10B981',
  successBg:      'rgba(16,185,129,0.1)',
  error:          '#EF4444',
  errorBg:        'rgba(239,68,68,0.1)',
  warning:        '#F59E0B',
  warningBg:      'rgba(245,158,11,0.1)',
  info:           '#3B82F6',
  infoBg:         'rgba(59,130,246,0.1)',
  white:          '#FFFFFF',
  black:          '#000000',
  transparent:    'transparent',
  overlay:        'rgba(0,0,0,0.5)',
  overlayLight:   'rgba(255,255,255,0.9)',
  glassLight:     'rgba(107,78,255,0.05)',
  glassBorder:    'rgba(107,78,255,0.12)',
  statusPending:  '#F59E0B',
  statusConfirmed:'#10B981',
  statusCancelled:'#EF4444',
  statusCompleted:'#8B5CF6',
  gradientPrimary: ['#6B4EFF', '#8B5CF6'] as [string, string],
  gradientDark:    ['#FAFAFF', '#EEF0FF'] as [string, string],
  gradientCard:    ['#FFFFFF', '#F9FAFB'] as [string, string],
  gradientAdmin:   ['#F5F3FF', '#EEF0FF'] as [string, string],
  secondary:      '#5B3EEF',
};

export type ThemeColors = typeof darkColors;

// ── Context ───────────────────────────────────────────────────
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  colors: darkColors,
});

const THEME_KEY = '@t4a_theme';

// ── Provider ──────────────────────────────────────────────────
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(true);

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val !== null) {
        setIsDark(val === 'dark');
      }
    }).catch(() => {});
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors: isDark ? darkColors : lightColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────
export const useTheme = () => useContext(ThemeContext);
