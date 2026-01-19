/**
 * Theme System Entry Point
 */

import { lightColors, darkColors, ColorScheme } from './colors';
import { typography, textStyles } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

export interface Theme {
  colors: ColorScheme;
  typography: typeof typography;
  textStyles: typeof textStyles;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  isDark: boolean;
}

export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  textStyles,
  spacing,
  borderRadius,
  shadows,
  isDark: false,
};

export const darkTheme: Theme = {
  colors: darkColors,
  typography,
  textStyles,
  spacing,
  borderRadius,
  shadows,
  isDark: true,
};

export { lightColors, darkColors, typography, textStyles, spacing, borderRadius, shadows };
export type { ColorScheme };

