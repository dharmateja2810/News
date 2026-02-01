/**
 * App Configuration
 * Centralized configuration to make app rebranding easy
 */

export const APP_CONFIG = {
  // App Identity - Change these values to rebrand the app
  APP_NAME: 'DailyDigest',
  APP_TAGLINE: 'Your Daily News, Curated',
  APP_DESCRIPTION: 'Stay informed with the latest news from around the world',
  
  // API Configuration
  // You can override this in Expo by setting:
  // EXPO_PUBLIC_API_URL=http://<your-laptop-ip>:3001/api
  // Notes:
  // - Android Emulator uses: http://10.0.2.2:3001/api
  // - Real device must use your LAN IP, not localhost
  API_BASE_URL:
    (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
    (__DEV__ ? 'http://10.156.21.125:3001/api' : 'https://api.dailydigest.com'),

  // Development: use local mock articles instead of backend API
  USE_MOCK_DATA: false,
  
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

