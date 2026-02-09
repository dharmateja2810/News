/**
 * Color Palette for DailyDigest
 * Modern, News-focused design with support for light and dark modes
 */

export const lightColors = {
  // Primary colors
  primary: '#1a1a2e',
  primaryLight: '#2a2a3e',
  primaryDark: '#0a0a1e',
  
  // Accent colors
  accent: '#0f4c75',
  accentLight: '#3282b8',
  accentDark: '#0a3556',
  
  // Background colors
  background: '#ffffff',
  backgroundSecondary: '#f5f6fa',
  backgroundTertiary: '#e8eaed',
  
  // Surface colors
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  
  // Text colors
  text: '#1a1a2e',
  textSecondary: '#606060',
  textTertiary: '#909090',
  textInverse: '#ffffff',
  
  // Border colors
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  
  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Semantic colors
  link: '#0f4c75',
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  // Category colors
  technology: '#3b82f6',
  business: '#10b981',
  sports: '#f59e0b',
  entertainment: '#ec4899',
  health: '#06b6d4',
  science: '#8b5cf6',
  politics: '#ef4444',
} as const;

export const darkColors = {
  // Primary colors
  primary: '#ffffff',
  primaryLight: '#e8e8e8',
  primaryDark: '#f8f8f8',
  
  // Accent colors
  accent: '#3282b8',
  accentLight: '#5fa4d8',
  accentDark: '#0f4c75',
  
  // Background colors
  background: '#0a0a0a',
  backgroundSecondary: '#1a1a1a',
  backgroundTertiary: '#2a2a2a',
  
  // Surface colors
  surface: '#1a1a1a',
  surfaceElevated: '#2a2a2a',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  textInverse: '#1a1a2e',
  
  // Border colors
  border: '#2a2a2a',
  borderLight: '#1a1a1a',
  
  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Semantic colors
  link: '#5fa4d8',
  overlay: 'rgba(0, 0, 0, 0.7)',
  
  // Category colors
  technology: '#3b82f6',
  business: '#10b981',
  sports: '#f59e0b',
  entertainment: '#ec4899',
  health: '#06b6d4',
  science: '#8b5cf6',
  politics: '#ef4444',
} as const;

// Use a looser type that allows different string values for different themes
export type ColorScheme = {
  [K in keyof typeof lightColors]: string;
};
