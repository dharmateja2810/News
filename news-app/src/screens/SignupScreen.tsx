/**
 * Signup Screen - Email/Password + Google/Apple OAuth
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

export const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const { register, loginWithGoogle, loginWithApple } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, name || undefined);
      Alert.alert(
        'Verification Email Sent',
        'Please check your email to verify your account before logging in.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Signup Failed', error.response?.data?.message || 'Could not create account');
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
      console.error('[SignupScreen] Google sign-in error:', error);
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
      console.error('[SignupScreen] Apple sign-in error:', error);
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
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Join {APP_CONFIG.APP_NAME} today
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
                {isGoogleLoading ? 'Signing up...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Apple Sign In - iOS only */}
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
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
                  {isAppleLoading ? 'Signing up...' : 'Continue with Apple'}
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
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Name <Text style={{ color: theme.colors.textSecondary }}>(optional)</Text>
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.backgroundSecondary }]}>
                <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Email *</Text>
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
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Password *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.backgroundSecondary }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password"
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

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Confirm Password *</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.backgroundSecondary }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.signupButton, { backgroundColor: theme.colors.accent }]}
              onPress={handleSignup}
              disabled={isLoading}
            >
              <Text style={styles.signupButtonText}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={[styles.terms, { color: theme.colors.textSecondary }]}>
            By signing up, you agree to our{' '}
            <Text style={{ color: theme.colors.accent }}>Terms of Service</Text> and{' '}
            <Text style={{ color: theme.colors.accent }}>Privacy Policy</Text>
          </Text>

          {/* Sign In Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[styles.loginLink, { color: theme.colors.accent }]}>Sign In</Text>
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
    },
    backButton: {
      marginBottom: 16,
      width: 40,
      height: 40,
      justifyContent: 'center',
    },
    header: {
      marginBottom: 24,
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
    signupButton: {
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    signupButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    terms: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: 24,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
      marginBottom: 24,
    },
    footerText: {
      fontSize: 14,
    },
    loginLink: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
