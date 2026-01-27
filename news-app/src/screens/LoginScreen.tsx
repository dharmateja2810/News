/**
 * Login Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LoginScreenNavigationProp } from '../navigation/types';
import { useTheme } from '../utils/hooks';
import { useAuthStore } from '../store';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG } from '../constants/appConfig';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { loginApi } from '../services/authApi';
import { setApiAccessToken } from '../services/api';

const TOKEN_KEY = 'dailydigest_jwt';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const theme = useTheme();
  const login = useAuthStore(state => state.login);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await loginApi(email.trim(), password);

      // Persist token securely for the shared Axios client
      await SecureStore.setItemAsync(TOKEN_KEY, res.token);
      setApiAccessToken(res.token);

      // Adapt backend token to the legacy store shape
      const userForStore = {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name || undefined,
        createdAt: new Date().toISOString(),
      };

      const tokensForStore = {
        accessToken: res.token,
        refreshToken: '',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // JWT defaults to 7d on backend
      };

      login(userForStore as any, tokensForStore as any);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Login failed. Please check your credentials.';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };
  
  const handleOAuthLogin = (provider: 'google' | 'github') => {
    Alert.alert('OAuth Login', `${provider} login will be implemented with backend integration`);
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="newspaper" size={60} color={theme.colors.accent} />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Sign in to continue reading
          </Text>
        </View>
        
        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email"
              placeholderTextColor={theme.colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons 
                name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                size={20} 
                color={theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.colors.accent }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={[styles.loginButtonText, { color: theme.colors.textInverse }]}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>
            or continue with
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        </View>
        
        {/* OAuth Buttons */}
        <View style={styles.oauthContainer}>
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => handleOAuthLogin('google')}
          >
            <Ionicons name="logo-google" size={24} color="#DB4437" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.oauthButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => handleOAuthLogin('github')}
          >
            <Ionicons name="logo-github" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        
        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <Text style={[styles.signupText, { color: theme.colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={[styles.signupLink, { color: theme.colors.accent }]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
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
  oauthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  oauthButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});

