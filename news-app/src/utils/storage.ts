/**
 * AsyncStorage wrapper for persistent data storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_TOKENS: '@daily_digest_auth_tokens',
  USER_DATA: '@daily_digest_user',
  BOOKMARKS: '@daily_digest_bookmarks',
  THEME: '@daily_digest_theme',
} as const;

export class Storage {
  /**
   * Save data to storage
   */
  static async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Error saving to storage:', error);
      throw error;
    }
  }
  
  /**
   * Get data from storage
   */
  static async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      if (jsonValue === null) return null;
      
      // Parse JSON safely
      const parsed = JSON.parse(jsonValue);
      
      // Ensure booleans are actually boolean type, not strings
      if (parsed === 'true') return true as T;
      if (parsed === 'false') return false as T;
      
      return parsed;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  }
  
  /**
   * Remove data from storage
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  }
  
  /**
   * Clear all storage
   */
  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }
  
  // Convenience methods for specific data
  static saveAuthTokens = (tokens: any) => Storage.setItem(STORAGE_KEYS.AUTH_TOKENS, tokens);
  static getAuthTokens = () => Storage.getItem(STORAGE_KEYS.AUTH_TOKENS);
  static removeAuthTokens = () => Storage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
  
  static saveUser = (user: any) => Storage.setItem(STORAGE_KEYS.USER_DATA, user);
  static getUser = () => Storage.getItem(STORAGE_KEYS.USER_DATA);
  static removeUser = () => Storage.removeItem(STORAGE_KEYS.USER_DATA);
  
  static saveBookmarks = (bookmarks: string[]) => Storage.setItem(STORAGE_KEYS.BOOKMARKS, bookmarks);
  static getBookmarks = () => Storage.getItem<string[]>(STORAGE_KEYS.BOOKMARKS);
  
  static saveTheme = async (isDark: boolean): Promise<void> => {
    try {
      // Store as boolean explicitly
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDark));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };
  
  static getTheme = async (): Promise<boolean | null> => {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      if (value === null) return null;
      
      // Parse and ensure it's a boolean
      const parsed = JSON.parse(value);
      return Boolean(parsed);
    } catch (error) {
      console.error('Error getting theme:', error);
      return null;
    }
  };
}

