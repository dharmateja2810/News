/**
 * Custom React Hooks
 */

import { useEffect, useState } from 'react';
import { useThemeStore } from '../store';
import { lightTheme, darkTheme, Theme } from '../theme';

/**
 * Hook to get the current theme based on user preference
 */
export const useTheme = (): Theme => {
  const isDark = useThemeStore(state => state.isDark);
  return isDark ? darkTheme : lightTheme;
};

/**
 * Hook for debouncing values (useful for search)
 */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

