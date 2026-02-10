/**
 * DailyDigest - Your Daily News, Curated
 * TikTok-style with bottom navigation
 */

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { BookmarksScreen } from './src/screens/BookmarksScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TabBar } from './src/components/TabBar';
import { SavedArticlesProvider } from './src/contexts/SavedArticlesContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const { isDark, colors } = useTheme();
  const { token, isBootstrapping } = useAuth();

  const DISABLE_AUTH_FOR_NOW = false;

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'search':
        return <SearchScreen />;
      case 'bookmarks':
        return <BookmarksScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.screenContainer}>
        {isBootstrapping ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : DISABLE_AUTH_FOR_NOW || token ? (
          renderScreen()
        ) : (
          <AuthScreen />
        )}
      </View>
      {(DISABLE_AUTH_FOR_NOW || !!token) && !isBootstrapping && (
        <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SavedArticlesProvider>
            <AppContent />
          </SavedArticlesProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
