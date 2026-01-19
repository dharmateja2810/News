/**
 * Navigation Type Definitions
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp } from '@react-navigation/native';
import { NewsArticle } from '../types';

// Auth Stack Navigation
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
};

// Main Stack Navigation (after authentication)
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  ArticleDetail: { article: NewsArticle };
  Search: undefined;
};

// Bottom Tab Navigation
export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Bookmarks: undefined;
  Profile: undefined;
};

// Root Stack (combines auth and main)
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

// Screen Props Types
export type SplashScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Splash'>;
export type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;
export type SignupScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Signup'>;

export type HomeScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Home'>;
export type CategoriesScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Categories'>;
export type BookmarksScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Bookmarks'>;
export type ProfileScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Profile'>;

export type ArticleDetailScreenNavigationProp = StackNavigationProp<MainStackParamList, 'ArticleDetail'>;
export type ArticleDetailScreenRouteProp = RouteProp<MainStackParamList, 'ArticleDetail'>;

export type SearchScreenNavigationProp = StackNavigationProp<MainStackParamList, 'Search'>;

