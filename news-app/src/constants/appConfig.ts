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
  API_BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api' 
    : 'https://api.dailydigest.com',
  
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

