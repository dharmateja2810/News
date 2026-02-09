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
  Technology: ['#3b82f6', '#1d4ed8'],
  Business: ['#10b981', '#059669'],
  Sports: ['#f59e0b', '#d97706'],
  Entertainment: ['#ec4899', '#db2777'],
  Health: ['#06b6d4', '#0891b2'],
  Science: ['#8b5cf6', '#7c3aed'],
  Politics: ['#ef4444', '#dc2626'],
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  All: 'grid',
  Technology: 'hardware-chip',
  Business: 'briefcase',
  Sports: 'football',
  Entertainment: 'film',
  Health: 'fitness',
  Science: 'flask',
  Politics: 'megaphone',
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
