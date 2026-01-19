/**
 * Search Screen - Simple Version
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

// Mock news data for search
const ALL_NEWS = [
  {
    id: '1',
    title: 'AI Breakthrough: New Language Model Surpasses Human Performance',
    description: 'Researchers unveil a revolutionary AI system.',
    imageUrl: 'https://picsum.photos/seed/tech1/400/300',
    source: 'TechCrunch',
    category: 'Technology',
  },
  {
    id: '2',
    title: 'Global Markets Rally as Economic Data Exceeds Expectations',
    description: 'Stock markets worldwide see significant gains.',
    imageUrl: 'https://picsum.photos/seed/business1/400/300',
    source: 'Bloomberg',
    category: 'Business',
  },
  {
    id: '3',
    title: 'Championship Victory: Underdog Team Wins Historic Finals',
    description: 'After trailing for three quarters, underdogs win.',
    imageUrl: 'https://picsum.photos/seed/sports1/400/300',
    source: 'ESPN',
    category: 'Sports',
  },
  {
    id: '4',
    title: 'New Cancer Treatment Shows 90% Success Rate',
    description: 'Revolutionary immunotherapy approach offers hope.',
    imageUrl: 'https://picsum.photos/seed/health1/400/300',
    source: 'Medical News',
    category: 'Health',
  },
  {
    id: '5',
    title: 'Space Telescope Discovers Earth-Like Planets',
    description: 'Astronomers identify potentially habitable worlds.',
    imageUrl: 'https://picsum.photos/seed/science1/400/300',
    source: 'National Geographic',
    category: 'Science',
  },
];

export const SearchScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useTheme();
  
  const filteredNews = searchQuery.trim() === ''
    ? []
    : ALL_NEWS.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
  
  const renderSearchResult = ({ item }: { item: typeof ALL_NEWS[0] }) => (
    <TouchableOpacity style={[styles.resultCard, { backgroundColor: colors.surface }]} activeOpacity={0.7}>
      <Image source={{ uri: item.imageUrl }} style={styles.resultImage} />
      <View style={styles.resultContent}>
        <Text style={styles.resultCategory}>{item.category}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.resultSource, { color: colors.textSecondary }]}>{item.source}</Text>
      </View>
    </TouchableOpacity>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search News</Text>
      </View>
      
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search articles..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Results */}
      {searchQuery.trim() === '' ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Search for News</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Enter keywords to find articles
          </Text>
        </View>
      ) : filteredNews.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sad-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Results Found</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Try different keywords
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNews}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    fontSize: 20,
    color: '#999',
    paddingHorizontal: 8,
  },
  resultsList: {
    paddingHorizontal: 20,
  },
  resultCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  resultImage: {
    width: 100,
    height: 100,
    backgroundColor: '#333',
  },
  resultContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  resultCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  resultSource: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
