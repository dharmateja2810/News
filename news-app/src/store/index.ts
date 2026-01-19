/**
 * Global State Management using Zustand
 */

import { create } from 'zustand';
import { AuthState, NewsState, BookmarksState, ThemeState, User, AuthTokens, NewsArticle } from '../types';
import { NEWS_CATEGORIES } from '../constants/appConfig';

// Auth Store
export const useAuthStore = create<AuthState & {
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
}>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTokens: (tokens) => set({ tokens }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  login: (user, tokens) => set({
    user,
    tokens,
    isAuthenticated: true,
    error: null,
  }),
  
  logout: () => set({
    user: null,
    tokens: null,
    isAuthenticated: false,
    error: null,
  }),
}));

// News Store
export const useNewsStore = create<NewsState & {
  setArticles: (articles: NewsArticle[]) => void;
  addArticles: (articles: NewsArticle[]) => void;
  setSelectedCategory: (category: typeof NEWS_CATEGORIES[number]) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setCurrentPage: (page: number) => void;
  resetNews: () => void;
}>((set) => ({
  articles: [],
  selectedCategory: 'All',
  isLoading: false,
  isRefreshing: false,
  error: null,
  hasMore: true,
  currentPage: 1,
  
  setArticles: (articles) => set({ articles }),
  addArticles: (articles) => set((state) => ({ 
    articles: [...state.articles, ...articles] 
  })),
  setSelectedCategory: (category) => set({ 
    selectedCategory: category,
    articles: [],
    currentPage: 1,
    hasMore: true,
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  setError: (error) => set({ error }),
  setHasMore: (hasMore) => set({ hasMore }),
  setCurrentPage: (page) => set({ currentPage: page }),
  resetNews: () => set({ 
    articles: [], 
    currentPage: 1, 
    hasMore: true,
    error: null,
  }),
}));

// Bookmarks Store
export const useBookmarksStore = create<BookmarksState & {
  toggleBookmark: (articleId: string) => void;
  isBookmarked: (articleId: string) => boolean;
  clearBookmarks: () => void;
}>((set, get) => ({
  bookmarkedIds: [],
  
  toggleBookmark: (articleId) => set((state) => {
    const isCurrentlyBookmarked = state.bookmarkedIds.includes(articleId);
    return {
      bookmarkedIds: isCurrentlyBookmarked
        ? state.bookmarkedIds.filter(id => id !== articleId)
        : [...state.bookmarkedIds, articleId]
    };
  }),
  
  isBookmarked: (articleId) => {
    return get().bookmarkedIds.includes(articleId);
  },
  
  clearBookmarks: () => set({ bookmarkedIds: [] }),
}));

// Theme Store
export const useThemeStore = create<ThemeState & {
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
}>((set) => ({
  isDark: false,
  
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setDarkMode: (isDark) => set({ isDark }),
}));

