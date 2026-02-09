/**
 * Login Screen - Email/Password + Google/Apple OAuth
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../utils/hooks';
import { useAuth } from '../contexts/AuthContext';
import { APP_CONFIG } from '../constants/appConfig';

// Ensure browser sessions complete properly
WebBrowser.maybeCompleteAuthSession();

interface Props {
  navigation: any;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const { login, loginWithGoogle, loginWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!loginWithGoogle) {
      Alert.alert('Not Available', 'Google Sign-In is not configured');
      return;
    }
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      console.error('[LoginScreen] Google sign-in error:', error);
      Alert.alert('Error', error.message || 'Google sign-in failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (!loginWithApple) {
      Alert.alert('Not Available', 'Apple Sign-In is not configured');
      return;
    }
    setIsAppleLoading(true);
    try {
      await loginWithApple();
    } catch (error: any) {
      console.error('[LoginScreen] Apple sign-in error:', error);
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('Error', error.message || 'Apple sign-in failed');
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Welcome Back
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Sign in to {APP_CONFIG.APP_NAME}
            </Text>
          </View>

          {/* OAuth Buttons */}
          <View style={styles.oauthSection}>
            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.oauthButton, { backgroundColor: theme.colors.backgroundSecondary }]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={[styles.oauthButtonText, { color: theme.colors.text }]}>
                {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Apple Sign In - iOS only */}
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={
                  theme.isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            {/* Apple Sign In - Web/Android fallback */}
            {Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={[styles.oauthButton, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}
                onPress={handleAppleSignIn}
                disabled={isAppleLoading}
              >
                <Ionicons name="logo-apple" size={20} color={theme.isDark ? '#000' : '#fff'} />
                <Text style={[styles.oauthButtonText, { color: theme.isDark ? '#000' : '#fff' }]}>
                  {isAppleLoading ? 'Signing in...' : 'Continue with Apple'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Email/Password Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.backgroundSecondary }]}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.backgroundSecondary }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: theme.colors.accent }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: theme.colors.accent }]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={[styles.signupLink, { color: theme.colors.accent }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      justifyContent: 'center',
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
    },
    oauthSection: {
      gap: 12,
    },
    oauthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 12,
      gap: 10,
    },
    oauthButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    appleButton: {
      height: 50,
      width: '100%',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 14,
    },
    form: {
      gap: 16,
    },
    inputContainer: {
      gap: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderRadius: 12,
      height: 52,
      gap: 12,
    },
    input: {
      flex: 1,
      fontSize: 16,
    },
    forgotPassword: {
      alignSelf: 'flex-end',
    },
    forgotPasswordText: {
      fontSize: 14,
      fontWeight: '500',
    },
    loginButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    loginButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 32,
    },
    footerText: {
      fontSize: 14,
    },
    signupLink: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
