/**
 * Categories Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../utils/hooks';
import { useNewsStore } from '../store';
import { NEWS_CATEGORIES } from '../constants/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CATEGORY_COLORS: Record<string, string[]> = {
  All: ['#667eea', '#764ba2'],
  'Business & Companies': ['#10b981', '#059669'],
  'Markets & Economy': ['#3b82f6', '#1d4ed8'],
  'Politics & Policy': ['#ef4444', '#dc2626'],
  'World News': ['#14b8a6', '#0d9488'],
  'Tech & Innovation': ['#8b5cf6', '#7c3aed'],
  'Property & Housing': ['#f97316', '#ea580c'],
  'Employment & Wages': ['#84cc16', '#65a30d'],
  'Lifestyle': ['#d946ef', '#c026d3'],
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  All: 'grid',
  'Business & Companies': 'briefcase',
  'Markets & Economy': 'trending-up',
  'Politics & Policy': 'megaphone',
  'World News': 'globe',
  'Tech & Innovation': 'hardware-chip',
  'Property & Housing': 'home',
  'Employment & Wages': 'people',
  'Lifestyle': 'cafe',
};

export const CategoriesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { setSelectedCategory } = useNewsStore();

  const handleCategoryPress = (category: typeof NEWS_CATEGORIES[number]) => {
    setSelectedCategory(category);
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Categories</Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Explore news by topic</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {NEWS_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.cardContainer}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={CATEGORY_COLORS[category] || ['#667eea', '#764ba2']}
                style={[styles.card, theme.shadows.lg]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={CATEGORY_ICONS[category]} size={40} color="rgba(255,255,255,0.9)" />
                <Text style={styles.categoryName}>{category}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginBottom: 16,
    marginRight: 16,
  },
  card: {
    width: '100%',
    height: 140,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});
