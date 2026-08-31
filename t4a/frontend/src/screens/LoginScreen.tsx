import React, { useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, KeyboardAvoidingView,
  Platform, StatusBar, Dimensions,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import T4ALogo from '../components/T4ALogo';
import apiClient from '../api/client';
import { loginSuccess, skipAuth } from '../redux/authSlice';
const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [usernameFocused, setUsernameFocused] = React.useState(false);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // Entrance animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(cardAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('auth/login/', { username, password });
      const userResponse = await apiClient.get('auth/me/', {
        headers: { Authorization: `Bearer ${response.data.access}` },
      });
      dispatch(loginSuccess({ token: response.data.access, user: userResponse.data }));
    } catch (err: any) {
      if (err.message === 'Network Error') {
        setError('Network Error. Is the backend running?');
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Decorative glowing orbs */}
      <View style={styles.orbTopLeft} />
      <View style={styles.orbBottomRight} />

      {/* Logo section */}
      <Animated.View style={[styles.logoSection, { opacity: logoAnim }]}>
        <T4ALogo variant="mark" theme="colored" scale={1.6} />
        <Text style={styles.brandName}>Tuition<Text style={{ color: colors.primary }}>4All</Text></Text>
        <Text style={styles.tagline}>A Trust Driven Learning Platform</Text>
      </Animated.View>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateY: cardAnim }], opacity: cardOpacity },
        ]}
      >
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSubtitle}>Sign in to your account</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Username */}
        <View style={[styles.inputWrapper, usernameFocused && styles.inputWrapperFocused]}>
          <Text style={styles.inputIcon}>👤</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            onFocus={() => setUsernameFocused(true)}
            onBlur={() => setUsernameFocused(false)}
          />
        </View>

        {/* Password */}
        <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            placeholderTextColor={colors.textMuted}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.inputIcon}>{showPassword ? '👁' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.loginBtnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Skip Button */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => dispatch(skipAuth())}
          activeOpacity={0.85}
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>

        {/* Register link */}
        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
          <Text style={styles.linkText}>
            Don't have an account?{' '}
            <Text style={styles.linkAccent}>Create one</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing['5'],
    paddingBottom: spacing['8'],
  },

  // Decorative orbs
  orbTopLeft: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primary,
    opacity: 0.12,
  },
  orbBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accent,
    opacity: 0.1,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing['8'],
  },
  brandName: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.text,
    marginTop: spacing['3'],
    letterSpacing: typography.tracking.tight,
  },
  tagline: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing['1'],
    letterSpacing: typography.tracking.wide,
  },

  // Card
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    padding: spacing['6'],
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold,
    color: colors.text,
    marginBottom: spacing['1'],
  },
  cardSubtitle: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginBottom: spacing['5'],
  },

  // Error
  errorBox: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing['3'],
    marginBottom: spacing['4'],
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.sm,
    textAlign: 'center',
    fontWeight: typography.weight.medium,
  },

  // Inputs
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing['3'],
    paddingHorizontal: spacing['4'],
    paddingVertical: spacing['1'],
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: spacing['2'],
  },
  eyeBtn: {
    padding: spacing['2'],
  },
  input: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.text,
    paddingVertical: spacing['3'],
  },

  // Button
  loginBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing['4'],
    alignItems: 'center',
    marginTop: spacing['2'],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.base,
    letterSpacing: typography.tracking.wide,
  },

  // Skip Button
  skipBtn: {
    paddingVertical: spacing['3'],
    alignItems: 'center',
    marginTop: spacing['2'],
  },
  skipBtnText: {
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
    fontSize: typography.size.base,
  },

  // Link
  linkRow: {
    alignItems: 'center',
    marginTop: spacing['5'],
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
  },
  linkAccent: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
});

export default LoginScreen;
