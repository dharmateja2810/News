/**
 * Simple Bottom Tab Bar with Vector Icons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface TabBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

type IconName = keyof typeof Ionicons.glyphMap;

interface Tab {
  id: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

const TABS: Tab[] = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { id: 'search', label: 'Search', icon: 'search-outline', iconActive: 'search' },
  { id: 'bookmarks', label: 'Saved', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onTabPress(tab.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isActive ? tab.iconActive : tab.icon} 
              size={24} 
              color={isActive ? colors.text : colors.textSecondary} 
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.text : colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingBottom: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

