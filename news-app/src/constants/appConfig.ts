/**
 * App Configuration
 * Centralized configuration to make app rebranding easy
 */

import { Platform } from 'react-native';

// Determine API URL based on platform
const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (!__DEV__) {
    return 'https://api.dailydigest.com';
  }
  // Development mode - pick the right URL for each platform
  if (Platform.OS === 'web') {
    return 'http://localhost:3001/api';
  }
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to reach host machine
    return 'http://10.0.2.2:3001/api';
  }
  // iOS simulator / real device - use LAN IP
  return 'http://192.168.1.18:3001/api';
};

export const APP_CONFIG = {
  // App Identity - Change these values to rebrand the app
  APP_NAME: 'DailyDigest',
  APP_TAGLINE: 'Your Daily News, Curated',
  APP_DESCRIPTION: 'Stay informed with the latest news from around the world',
  
  // API Configuration
  API_BASE_URL: getApiBaseUrl(),
  
  // Rate Limiting
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW: 3600000, // 1 hour in milliseconds
  
  // Pagination
  NEWS_PER_PAGE: 10,
  
  // Cache
  CACHE_DURATION: 300000, // 5 minutes in milliseconds
  
  // OAuth Providers
  OAUTH_PROVIDERS: {
    GOOGLE: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID || '',
    },
    GITHUB: {
      enabled: true,
      clientId: process.env.GITHUB_CLIENT_ID || '',
    },
  },
} as const;

export const NEWS_CATEGORIES = [
  'All',
  'Technology',
  'Business',
  'Sports',
  'Entertainment',
  'Health',
  'Science',
  'Politics',
] as const;

export type NewsCategory = typeof NEWS_CATEGORIES[number];

