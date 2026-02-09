/**
 * App Navigator - Main navigation structure
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useThemeStore, useBookmarksStore } from '../store';
import { useTheme } from '../utils/hooks';
import { Storage } from '../utils/storage';

// Auth Screens
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';

// Main Screens
import { HomeScreen } from '../screens/HomeScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { BookmarksScreen } from '../screens/BookmarksScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ArticleDetailScreen } from '../screens/ArticleDetailScreen';
import { SearchScreen } from '../screens/SearchScreen';

import { AuthStackParamList, MainStackParamList, MainTabParamList } from './types';

const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  const theme = useTheme();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Categories':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Bookmarks':
              iconName = focused ? 'bookmark' : 'bookmark-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <MainTab.Screen name="Home" component={HomeScreen} />
      <MainTab.Screen name="Categories" component={CategoriesScreen} />
      <MainTab.Screen name="Bookmarks" component={BookmarksScreen} />
      <MainTab.Screen name="Profile" component={ProfileScreen} />
    </MainTab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator>
      <MainStack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <MainStack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </MainStack.Navigator>
  );
}

export function AppNavigator() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const setDarkMode = useThemeStore(state => state.setDarkMode);
  const bookmarkedIds = useBookmarksStore(state => state.bookmarkedIds);

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const savedTheme = await Storage.getTheme();
        if (savedTheme !== null && typeof savedTheme === 'boolean') {
          setDarkMode(savedTheme);
        }

        const savedBookmarks = await Storage.getBookmarks();
        if (savedBookmarks && Array.isArray(savedBookmarks)) {
          savedBookmarks.forEach(id => {
            if (typeof id === 'string') {
              useBookmarksStore.getState().toggleBookmark(id);
            }
          });
        }
      } catch (error) {
        console.error('Error loading persisted data:', error);
      }
    };

    loadPersistedData();
  }, []);

  useEffect(() => {
    Storage.saveBookmarks(bookmarkedIds);
  }, [bookmarkedIds]);

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

