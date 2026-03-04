/**
 * Bookmarks Screen - List view with TikTok-style detail view
 * Shows all saved articles, tap one to scroll through them full-screen
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { UiArticle } from '../services/articlesApi';
import { listBookmarks } from '../services/bookmarksApi';
import { mapArticleToUi } from '../services/articlesApi';

const { width, height } = Dimensions.get('window');

export const BookmarksScreen: React.FC = () => {
  const { savedArticleIds, toggleSave, isSaved } = useSavedArticles();
  const { token } = useAuth();
  const [savedArticles, setSavedArticles] = useState<UiArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const { colors } = useTheme();
  const detailListRef = useRef<FlatList<UiArticle>>(null);

  // Full-screen detail view state
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Measure the available height for a single "page" in detail view
  const [pageHeight, setPageHeight] = useState(height);
  const imageHeight = Math.round(pageHeight * 0.352);
  const contentHeight = Math.max(0, pageHeight - imageHeight);

  useEffect(() => {
    if (!token) {
      setSavedArticles([]);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const bookmarked = await listBookmarks();
        const mapped = bookmarked.map(mapArticleToUi);
        const uniqueById = Array.from(
          new Map(mapped.map((article) => [article.id, article])).values(),
        );
        setSavedArticles(uniqueById);
      } catch (error) {
        console.error('Error loading saved articles:', error);
        setSavedArticles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [savedArticleIds, token]);

  const handleLike = (articleId: string) => {
    setLikedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  // Open detail view starting at a specific article
  const openDetailView = (index: number) => {
    setSelectedIndex(index);
    setShowDetailView(true);
    // Scroll to the selected article after modal opens
    setTimeout(() => {
      detailListRef.current?.scrollToIndex({ index, animated: false });
    }, 100);
  };

  // Render item for the LIST view (card style)
  const renderListItem = ({ item, index }: { item: UiArticle; index: number }) => (
    <TouchableOpacity
      style={[styles.articleCard, { backgroundColor: colors.surface }]}
      onPress={() => openDetailView(index)}
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

  // Render item for the DETAIL view (full-screen TikTok style)
  const renderDetailItem = ({ item }: { item: UiArticle }) => {
    const isLiked = likedArticles.has(item.id);
    const articleIsSaved = isSaved(item.id);
    const likeCount = item.likeCount ?? 0;
    const titleWords = item.title.trim().split(/\s+/).filter(Boolean).length;
    const titleLines = titleWords > 10 ? 3 : 2;

    return (
      <View style={[styles.newsItem, { height: pageHeight }]}>
        {/* Top Half - Image */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <Image source={{ uri: item.imageUrl }} style={styles.newsImage} />
        </View>

        {/* Bottom Half - Content */}
        <View style={[styles.contentContainer, { backgroundColor: colors.background, height: contentHeight }]}>
          {/* Title - full width */}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={titleLines}>
            {item.title}
          </Text>

          {/* Description + Actions row */}
          <View style={styles.descriptionActionsRow}>
            {/* Description side */}
            {(() => {
              const full = (item.description || '').trim();
              const MAX_WORDS = 140;
              const words = full.split(/\s+/).filter(Boolean);
              const preview = words.slice(0, MAX_WORDS).join(' ');
              return (
                <View style={styles.descriptionContainer}>
                  <Text
                    style={[styles.description, { color: colors.textSecondary }]}
                    numberOfLines={16}
                    ellipsizeMode="clip"
                  >
                    {preview}
                  </Text>

                  {/* Meta Info */}
                  <View style={styles.meta}>
                    <Text style={[styles.source, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.source}
                    </Text>
                    <Text style={[styles.dot, { color: colors.border }]}>•</Text>
                    <Text style={[styles.time, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.time || ' '}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Right-side vertical actions */}
            <View style={styles.rightActions}>
              {/* Like */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleLike(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isLiked ? '#ff4444' : colors.text}
                />
                <Text style={[styles.actionCount, { color: colors.text }]}>
                  {isLiked ? likeCount + 1 : likeCount}
                </Text>
              </TouchableOpacity>

              {/* Unsave */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => void toggleSave(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={articleIsSaved ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={articleIsSaved ? '#0f4c75' : colors.text}
                />
                <Text style={[styles.actionCount, { color: colors.text }]}>
                  {articleIsSaved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => void Share.share({ message: item.sourceUrl })}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={24} color={colors.text} />
                <Text style={[styles.actionCount, { color: colors.text }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Empty/Loading states
  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to view bookmarks</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Your saved articles will appear here after you sign in
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 12 }]}>
            Loading saved articles...
          </Text>
        </View>
      </View>
    );
  }

  if (savedArticles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Saved Articles Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Tap the bookmark icon on articles to save them here
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderTitle, { color: colors.text }]}>Saved Articles</Text>
        <Text style={[styles.listHeaderCount, { color: colors.textSecondary }]}>
          {savedArticles.length} saved
        </Text>
      </View>

      {/* List View */}
      <FlatList
        data={savedArticles}
        renderItem={renderListItem}
        keyExtractor={(item, index) => `list-${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Full-screen Detail View Modal */}
      <Modal
        visible={showDetailView}
        animationType="slide"
        onRequestClose={() => setShowDetailView(false)}
      >
        <View style={styles.detailContainer}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowDetailView(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Full-screen scrollable list */}
          <View
            style={styles.listArea}
            onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
          >
            <FlatList
              ref={detailListRef}
              data={savedArticles}
              renderItem={renderDetailItem}
              keyExtractor={(item, index) => `detail-${item.id}-${index}`}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={pageHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              initialScrollIndex={selectedIndex}
              getItemLayout={(_, index) => ({
                length: pageHeight,
                offset: pageHeight * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  detailListRef.current?.scrollToIndex({ index: info.index, animated: false });
                }, 100);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // List view styles
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  listHeaderTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  listHeaderCount: {
    fontSize: 14,
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
  // Detail view styles
  detailContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listArea: {
    flex: 1,
  },
  newsItem: {
    width,
  },
  imageContainer: {
    width: '100%',
  },
  newsImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
    lineHeight: 26,
  },
  descriptionActionsRow: {
    flexDirection: 'row',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  descriptionContainer: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  source: {
    fontSize: 14,
    fontWeight: '600',
  },
  dot: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  time: {
    fontSize: 14,
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 12,
    paddingTop: 4,
    gap: 14,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCount: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
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
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
