/**
 * Saved Articles Context
 * Share saved articles between screens
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toggleBookmark, listBookmarks } from '../services/bookmarksApi';
import { useAuth } from './AuthContext';
import { APP_CONFIG } from '../constants/appConfig';

const LOCAL_SAVED_KEY = 'dd:saved_article_ids';

interface SavedArticlesContextType {
  savedArticleIds: Set<string>;
  isLoading: boolean;
  refresh: () => Promise<void>;
  toggleSave: (articleId: string) => Promise<void>;
  isSaved: (articleId: string) => boolean;
}

const SavedArticlesContext = createContext<SavedArticlesContextType | undefined>(undefined);

export const SavedArticlesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set());

  const refresh = async () => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      const raw = await AsyncStorage.getItem(LOCAL_SAVED_KEY);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      setSavedArticleIds(new Set(ids));
      return;
    }

    if (!token) {
      setSavedArticleIds(new Set());
      return;
    }
    setIsLoading(true);
    try {
      const articles = await listBookmarks();
      setSavedArticleIds(new Set(articles.map((a) => a.id)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  
  const toggleSave = async (articleId: string) => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      setSavedArticleIds((prev) => {
        const next = new Set(prev);
        if (next.has(articleId)) next.delete(articleId);
        else next.add(articleId);
        void AsyncStorage.setItem(LOCAL_SAVED_KEY, JSON.stringify([...next]));
        return next;
      });
      return;
    }

    if (!token) return;

    // Optimistic update
    setSavedArticleIds((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });

    try {
      const res = await toggleBookmark(articleId);
      setSavedArticleIds((prev) => {
        const next = new Set(prev);
        if (res.bookmarked) next.add(articleId);
        else next.delete(articleId);
        return next;
      });
    } catch {
      // Re-sync on failure
      await refresh();
    }
  };
  
  const isSaved = (articleId: string) => {
    return savedArticleIds.has(articleId);
  };
  
  const value = useMemo(
    () => ({ savedArticleIds, isLoading, refresh, toggleSave, isSaved }),
    [savedArticleIds, isLoading],
  );

  return (
    <SavedArticlesContext.Provider value={value}>
      {children}
    </SavedArticlesContext.Provider>
  );
};

export const useSavedArticles = () => {
  const context = useContext(SavedArticlesContext);
  if (!context) {
    throw new Error('useSavedArticles must be used within SavedArticlesProvider');
  }
  return context;
};

