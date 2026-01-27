/**
 * DailyDigest - Your Daily News, Curated
 * TikTok-style with bottom navigation
 */

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { HomeScreenTikTok } from './src/screens/HomeScreenTikTok';
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

  // TEMP: Disable login screen / auth-gating (always show app).
  // Flip to `false` to re-enable authentication.
  const DISABLE_AUTH_FOR_NOW = true;
  
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
    <ThemeProvider>
      <AuthProvider>
        <SavedArticlesProvider>
          <AppContent />
        </SavedArticlesProvider>
      </AuthProvider>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
