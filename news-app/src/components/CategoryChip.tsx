/**
 * CategoryChip Component
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../utils/hooks';
import { NewsCategory } from '../constants/appConfig';

interface CategoryChipProps {
  category: NewsCategory;
  isSelected: boolean;
  onPress: () => void;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  category,
  isSelected,
  onPress,
}) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: isSelected
            ? theme.colors.accent
            : theme.colors.backgroundSecondary,
          borderColor: isSelected ? theme.colors.accent : theme.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          {
            color: isSelected ? theme.colors.textInverse : theme.colors.text,
            fontWeight: isSelected ? '700' : '600',
          },
        ]}
      >
        {category}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
  },
});

