/**
 * Search Screen - Simple Version
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { UiArticle } from '../services/articlesApi';
import { NewsDetailModal } from './NewsDetailModal';
import { APP_CONFIG } from '../constants/appConfig';
import { MOCK_ARTICLES } from '../services/mockData';
import { formatRelativeTime } from '../utils/formatters';
import type { NewsArticle } from '../types';

function mapMockToUi(a: NewsArticle): UiArticle {
  return {
    id: a.id,
    title: a.title,
    // Prefer full content so the detail modal has enough text.
    description: a.content || a.description || '',
    imageUrl: a.imageUrl,
    source: a.source,
    category: a.category,
    time: formatRelativeTime(a.publishedDate),
    sourceUrl: a.sourceUrl,
    publishedAt: a.publishedDate,
    likeCount: 0,
    bookmarkCount: 0,
  };
}

export const SearchScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useTheme();

  const [results, setResults] = useState<UiArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<UiArticle | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          if (APP_CONFIG.USE_MOCK_DATA) {
            const qLower = q.toLowerCase();
            const filtered = MOCK_ARTICLES.filter((a) => {
              return (
                a.title.toLowerCase().includes(qLower) ||
                a.description.toLowerCase().includes(qLower) ||
                a.source.toLowerCase().includes(qLower) ||
                a.category.toLowerCase().includes(qLower)
              );
            }).slice(0, 20);
            setResults(filtered.map(mapMockToUi));
            return;
          }
          // Backend mode (future): use API search here.
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const renderSearchResult = ({ item }: { item: UiArticle }) => (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: colors.surface }]}
      activeOpacity={0.7}
      onPress={() => {
        setSelectedArticle(item);
        setShowDetailModal(true);
      }}
    >
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
      ) : loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 12 }]}> 
            Searching...
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sad-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Results Found</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}> 
            Try different keywords
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
        />
      )}

      <NewsDetailModal
        visible={showDetailModal}
        article={selectedArticle}
        onClose={() => setShowDetailModal(false)}
      />
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
