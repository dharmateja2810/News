/**
 * Placeholder illustration SVG for news cards
 * Generates a category-themed abstract illustration
 */
import React from 'react';
import Svg, { Rect, Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  width: number;
  height: number;
  category: string;
}

const CATEGORY_THEMES: Record<string, { bg: string; accent: string; secondary: string }> = {
  Markets: { bg: '#0F172A', accent: '#3B82F6', secondary: '#1E3A5F' },
  Business: { bg: '#042F2E', accent: '#10B981', secondary: '#134E4A' },
  Technology: { bg: '#1E1B4B', accent: '#8B5CF6', secondary: '#312E81' },
  Politics: { bg: '#450A0A', accent: '#EF4444', secondary: '#7F1D1D' },
  Sports: { bg: '#451A03', accent: '#F59E0B', secondary: '#78350F' },
  Health: { bg: '#083344', accent: '#06B6D4', secondary: '#155E75' },
  Science: { bg: '#1E1B4B', accent: '#6366F1', secondary: '#312E81' },
  Entertainment: { bg: '#500724', accent: '#EC4899', secondary: '#831843' },
  World: { bg: '#042F2E', accent: '#14B8A6', secondary: '#134E4A' },
  Property: { bg: '#431407', accent: '#F97316', secondary: '#7C2D12' },
  Employment: { bg: '#1A2E05', accent: '#84CC16', secondary: '#365314' },
  Lifestyle: { bg: '#4A044E', accent: '#D946EF', secondary: '#701A75' },
};

export const PlaceholderIllustration: React.FC<Props> = ({ width, height, category }) => {
  const theme = CATEGORY_THEMES[category] ?? CATEGORY_THEMES.Markets;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={theme.bg} />
          <Stop offset="1" stopColor={theme.secondary} />
        </LinearGradient>
        <LinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.accent} stopOpacity="0.4" />
          <Stop offset="1" stopColor={theme.accent} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Background */}
      <Rect x="0" y="0" width={width} height={height} fill="url(#bg)" />

      {/* Abstract shapes */}
      <Circle cx={width * 0.7} cy={height * 0.35} r={height * 0.4} fill={theme.accent} opacity={0.08} />
      <Circle cx={width * 0.3} cy={height * 0.65} r={height * 0.3} fill={theme.accent} opacity={0.06} />
      <Circle cx={width * 0.8} cy={height * 0.7} r={height * 0.2} fill={theme.accent} opacity={0.1} />

      {/* Accent line pattern */}
      <Path
        d={`M0 ${height * 0.6} Q${width * 0.25} ${height * 0.4} ${width * 0.5} ${height * 0.55} T${width} ${height * 0.45}`}
        stroke={theme.accent}
        strokeWidth={2}
        fill="none"
        opacity={0.3}
      />
      <Path
        d={`M0 ${height * 0.7} Q${width * 0.3} ${height * 0.5} ${width * 0.6} ${height * 0.65} T${width} ${height * 0.55}`}
        stroke={theme.accent}
        strokeWidth={1.5}
        fill="none"
        opacity={0.15}
      />

      {/* Glow effect at top */}
      <Rect x="0" y="0" width={width} height={height * 0.5} fill="url(#glow)" />

      {/* Grid dots */}
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 8 }).map((_, col) => (
          <Circle
            key={`${row}-${col}`}
            cx={width * 0.1 + col * (width * 0.1)}
            cy={height * 0.2 + row * (height * 0.15)}
            r={1.5}
            fill={theme.accent}
            opacity={0.15}
          />
        ))
      )}
    </Svg>
  );
};
