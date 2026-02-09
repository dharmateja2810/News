/**
 * Home Screen - TikTok Style
 * Full-screen vertical scrolling news feed
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { useTheme } from '../contexts/ThemeContext';
import type { UiArticle } from '../services/articlesApi';
import { listArticles, mapArticleToUi } from '../services/articlesApi';
import { APP_CONFIG, NEWS_CATEGORIES } from '../constants/appConfig';

const { width, height } = Dimensions.get('window');

const CATEGORIES = [...NEWS_CATEGORIES];

export const HomeScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const { toggleSave: handleSave, isSaved } = useSavedArticles();
  const { colors } = useTheme();
  const lastTapRef = React.useRef<{ [key: string]: number }>({});
  const listRef = React.useRef<FlatList<UiArticle>>(null);

  // Measure the available height for a single "page" so content isn't hidden behind the bottom tab bar.
  const [pageHeight, setPageHeight] = useState(height);
  // Reduce image height by ~20% (44% -> 35.2% of page height)
  const imageHeight = Math.round(pageHeight * 0.352);
  const contentHeight = Math.max(0, pageHeight - imageHeight);

  const [articles, setArticles] = useState<UiArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadFromApi = async (refresh: boolean) => {
    setIsLoading(!refresh);
    setIsRefreshing(refresh);
    try {
      const nextPage = refresh ? 1 : page;
      const res = await listArticles({
        page: nextPage,
        limit: APP_CONFIG.NEWS_PER_PAGE,
        category: selectedCategory === 'All' ? undefined : selectedCategory,
      });
      const mapped = res.articles.map(mapArticleToUi);
      setArticles(prev => (refresh ? mapped : [...prev, ...mapped]));
      setPage(nextPage + 1);
      setHasMore(res.pagination.page < res.pagination.totalPages);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setCurrentIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    void loadFromApi(true);
  }, [selectedCategory]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadFromApi(true);
  };

  const onViewableItemsChanged = React.useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

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

  const handleDoubleTap = (articleId: string) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    const lastTap = lastTapRef.current[articleId] || 0;

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected - toggle like
      void (async () => {
        // Optimistic
        handleLike(articleId);
        // Backend mode (future): wire like API here if needed.
      })();
    }
    lastTapRef.current[articleId] = now;
  };

  const renderNewsItem = ({ item }: { item: UiArticle }) => {
    const isLiked = likedArticles.has(item.id);
    const articleIsSaved = isSaved(item.id);
    const likeCount = item.likeCount ?? 0;
    const titleWords = item.title.trim().split(/\s+/).filter(Boolean).length;
    const titleLines = titleWords > 10 ? 3 : 2;

    return (
      <View style={[styles.newsItem, { height: pageHeight }]}>
        {/* Top Half - Image */}
        <TouchableOpacity
          style={[styles.imageContainer, { height: imageHeight }]}
          activeOpacity={1}
          onPress={() => handleDoubleTap(item.id)}
        >
          <Image source={{ uri: item.imageUrl }} style={styles.newsImage} />
        </TouchableOpacity>

        {/* Bottom Half - Content */}
        <View style={[styles.contentContainer, { backgroundColor: colors.background, height: contentHeight }]}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={titleLines}>
            {item.title}
          </Text>

          {/* Description */}
          {(() => {
            const full = (item.description || '').trim();
            // Cap by word count so we don't show "..."/ellipsis and we keep layout stable.
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

                {/* Meta Info (right after text, not stuck at bottom) */}
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

          {/* Right-side vertical actions (start aligned with title) */}
          <View style={styles.rightActions}>
            {/* Like */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => void handleLike(item.id)}
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

            {/* Save */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => void handleSave(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={articleIsSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={articleIsSaved ? '#0f4c75' : colors.text}
              />
              <Text style={[styles.actionCount, { color: colors.text }]}>Save</Text>
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
    );
  };

  return (
    <View style={styles.container}>
      {/* Top category tabs (Inshorts-style) */}
      <SafeAreaView edges={['top']} style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={styles.tabItem}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedCategory(category);
                  setCurrentIndex(0);
                  listRef.current?.scrollToOffset({ offset: 0, animated: false });
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? colors.accent : 'rgba(255,255,255,0.65)' },
                  ]}
                >
                  {category === 'All' ? 'My Feed' : category}
                </Text>
                {active ? (
                  <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Full-Screen Vertical Scroll (measured so bottom tab bar doesn't cover content) */}
      <View
        style={styles.listArea}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setPageHeight(h);
        }}
      >
        {isLoading && articles.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading news...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={articles}
            renderItem={renderNewsItem}
            keyExtractor={(item) => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(data, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            onEndReached={() => {
              if (!isLoading && hasMore) {
                void loadFromApi(false);
              }
            }}
            onEndReachedThreshold={0.5}
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <View style={styles.loading}>
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>No articles found.</Text>
                <TouchableOpacity
                  onPress={() => void onRefresh()}
                  style={[styles.retryButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  tabsBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 18,
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 6,
    height: 3,
    width: 26,
    borderRadius: 3,
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
    paddingRight: 80,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
    lineHeight: 26,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  descriptionContainer: {
    // Don't use flex:1 here, otherwise the meta row gets pushed to the bottom.
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
    position: 'absolute',
    right: 12,
    top: 20,
    alignItems: 'center',
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontWeight: '700',
  },
});

