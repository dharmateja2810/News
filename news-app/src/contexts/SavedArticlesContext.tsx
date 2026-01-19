/**
 * Saved Articles Context
 * Share saved articles between screens
 */

import React, { createContext, useContext, useState } from 'react';

interface SavedArticlesContextType {
  savedArticleIds: Set<string>;
  toggleSave: (articleId: string) => void;
  isSaved: (articleId: string) => boolean;
}

const SavedArticlesContext = createContext<SavedArticlesContextType | undefined>(undefined);

export const SavedArticlesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set());
  
  const toggleSave = (articleId: string) => {
    setSavedArticleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };
  
  const isSaved = (articleId: string) => {
    return savedArticleIds.has(articleId);
  };
  
  return (
    <SavedArticlesContext.Provider value={{ savedArticleIds, toggleSave, isSaved }}>
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

