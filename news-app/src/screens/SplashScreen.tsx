/**
 * Splash Screen
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SplashScreenNavigationProp } from '../navigation/types';
import { useTheme } from '../utils/hooks';
import { APP_CONFIG } from '../constants/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const theme = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.accent]}
      style={styles.container}
    >
      <View style={styles.content}>
        <Ionicons name="newspaper" size={80} color={theme.colors.textInverse} />
        <Text style={[styles.title, { color: theme.colors.textInverse }]}>
          {APP_CONFIG.APP_NAME}
        </Text>
        <Text style={[styles.tagline, { color: theme.colors.textInverse }]}>
          {APP_CONFIG.APP_TAGLINE}
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    opacity: 0.9,
  },
});
