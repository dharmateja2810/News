/**
 * Bookmarks Screen - Shows Saved Articles
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { NewsDetailModal } from './NewsDetailModal';
import { useTheme } from '../contexts/ThemeContext';
import type { UiArticle } from '../services/articlesApi';
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

export const BookmarksScreen: React.FC = () => {
  const { savedArticleIds, toggleSave, isLoading: bookmarksLoading } = useSavedArticles();
  const [savedArticles, setSavedArticles] = useState<UiArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<UiArticle | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        if (APP_CONFIG.USE_MOCK_DATA) {
          const ids = savedArticleIds;
          const filtered = MOCK_ARTICLES.filter((a) => ids.has(a.id));
          setSavedArticles(filtered.map(mapMockToUi));
          return;
        }
        // Backend mode (future): fetch saved articles from API.
        setSavedArticles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [savedArticleIds]);
  
  const handleArticlePress = (article: UiArticle) => {
    setSelectedArticle(article);
    setShowDetailModal(true);
  };
  
  const renderSavedArticle = ({ item }: { item: UiArticle }) => (
    <TouchableOpacity 
      style={[styles.articleCard, { backgroundColor: colors.surface }]}
      onPress={() => handleArticlePress(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.articleImage} />
      <View style={styles.articleContent}>
        <Text style={styles.articleCategory}>{item.category}</Text>
        <Text style={[styles.articleTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.articleSource, { color: colors.textSecondary }]}>{item.source}</Text>
      </View>
      <TouchableOpacity 
        style={styles.unsaveButton}
        onPress={(e) => {
          e.stopPropagation();
          void toggleSave(item.id);
        }}
      >
        <Ionicons name="bookmark" size={24} color={colors.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved Articles</Text>
        <Text style={[styles.headerCount, { color: colors.textSecondary }]}>{savedArticles.length} saved</Text>
      </View>
      
      {loading || bookmarksLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 12 }]}>
            Loading saved articles...
          </Text>
        </View>
      ) : savedArticles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Saved Articles Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Tap the bookmark icon on articles to save them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedArticles}
          renderItem={renderSavedArticle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerCount: {
    fontSize: 14,
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
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  articleCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  articleImage: {
    width: 120,
    height: 120,
    backgroundColor: '#333',
  },
  articleContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  articleCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  articleSource: {
    fontSize: 12,
  },
  unsaveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
});
