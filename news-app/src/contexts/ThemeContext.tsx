/**
 * Theme Context - Manage Light/Dark Mode
 */

import React, { createContext, useContext, useState } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
  };
}

const lightTheme = {
  background: '#ffffff',
  surface: '#f5f6fa',
  text: '#1a1a2e',
  textSecondary: '#606060',
  border: '#e0e0e0',
  accent: '#0f4c75',
};

const darkTheme = {
  background: '#000000',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#999999',
  border: '#333333',
  accent: '#0f4c75',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false); // Start with light mode
  
  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };
  
  const colors = isDark ? darkTheme : lightTheme;
  
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

