/**
 * DailyDigest - Your Daily News, Curated
 * TikTok-style with bottom navigation
 */

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { HomeScreenTikTok } from './src/screens/HomeScreenTikTok';
import { SearchScreen } from './src/screens/SearchScreen';
import { BookmarksScreen } from './src/screens/BookmarksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TabBar } from './src/components/TabBar';
import { SavedArticlesProvider } from './src/contexts/SavedArticlesContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const { isDark, colors } = useTheme();
  
  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreenTikTok />;
      case 'search':
        return <SearchScreen />;
      case 'bookmarks':
        return <BookmarksScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreenTikTok />;
    }
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>
      <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SavedArticlesProvider>
        <AppContent />
      </SavedArticlesProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});
