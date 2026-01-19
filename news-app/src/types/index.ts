/**
 * Type Definitions for DailyDigest
 */

import { NewsCategory } from '../constants/appConfig';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  sourceUrl: string;
  imageUrl: string;
  source: string;
  author?: string;
  category: NewsCategory;
  publishedDate: string;
  createdAt: string;
  isBookmarked?: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  oauthProvider?: 'google' | 'github' | 'email';
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  name?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface NewsState {
  articles: NewsArticle[];
  selectedCategory: NewsCategory;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
}

export interface BookmarksState {
  bookmarkedIds: string[];
}

export interface ThemeState {
  isDark: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

