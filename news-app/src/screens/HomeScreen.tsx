/**
 * Home Screen - Bloomberg Card Style
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ExplainerView } from '../components/ExplainerView';
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
  const [activeExplainerId, setActiveExplainerId] = useState<string | null>(null);
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
      // Double tap detected - pop up the AI explainer!
      setActiveExplainerId(articleId);
    }
    lastTapRef.current[articleId] = now;
  };

  const renderNewsItem = ({ item }: { item: UiArticle }) => {
    const isLiked = likedArticles.has(item.id);
    const articleIsSaved = isSaved(item.id);
    const likeCount = item.likeCount ?? 0;

    // Derive a short key-takeaway from the first 1-2 sentences of the description.
    const fullText = (item.description || '').trim();
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
    const keyTakeaway = sentences.slice(0, 2).join(' ').trim() || fullText.slice(0, 120);
    const bodyText = sentences.slice(2, 8).join(' ').trim() || fullText.slice(keyTakeaway.length).trim();

    // Build sources label: source name + "· time"
    const sourcesLabel = [item.source, item.time].filter(Boolean).join('  ·  ');

    // Category colour map
    const categoryColors: Record<string, string> = {
      Markets: '#3B82F6',
      Business: '#10B981',
      Technology: '#8B5CF6',
      Politics: '#EF4444',
      Sports: '#F59E0B',
      Health: '#06B6D4',
      Science: '#6366F1',
      Entertainment: '#EC4899',
      World: '#14B8A6',
    };
    const catColor = categoryColors[item.category] ?? '#3B82F6';

    return (
      <View style={[styles.newsItem, { height: pageHeight }]}>
        {/* ── IMAGE AREA ── */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <Image source={{ uri: item.imageUrl }} style={styles.newsImage} />
          {/* Dark gradient over the image for readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* BREAKING badge – top left */}
          <View style={styles.breakingBadge}>
            <Text style={styles.breakingText}>BREAKING</Text>
          </View>

          {/* AI Explainer pill – top right */}
          <TouchableOpacity
            style={styles.aiPill}
            onPress={() => setActiveExplainerId(item.id)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8B5CF6', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiPillGradient}
            >
              <Ionicons name="sparkles" size={12} color="#FFF" />
              <Text style={styles.aiPillText}>AI Explain</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── CONTENT AREA ── */}
        <View style={[styles.contentCard, { height: contentHeight }]}>
          {/* Row 1: Category pill + sources/time */}
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { borderColor: catColor }]}>
              <Text style={[styles.categoryPillText, { color: catColor }]}>
                {item.category.toUpperCase()}
              </Text>
            </View>
            <View style={styles.likeRow}>
              <Ionicons name="newspaper-outline" size={12} color="#888" />
              <Text style={styles.sourcesCount}>{sourcesLabel}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.cardTitle} numberOfLines={3}>
            {item.title}
          </Text>

          {/* Key takeaway – blue left-border quote */}
          {keyTakeaway.length > 0 && (
            <View style={styles.takeawayBlock}>
              <Text style={styles.takeawayText} numberOfLines={3}>
                {keyTakeaway}
              </Text>
            </View>
          )}

          {/* Body text */}
          {bodyText.length > 0 && (
            <Text style={styles.bodyText} numberOfLines={5}>
              {bodyText}
            </Text>
          )}

          {/* ── BOTTOM ROW ── */}
          <View style={styles.bottomRow}>
            {/* View more button */}
            <TouchableOpacity
              style={styles.viewMoreBtn}
              onPress={() => item.sourceUrl ? void Linking.openURL(item.sourceUrl) : undefined}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.text} />
              <Text style={[styles.viewMoreText, { color: colors.text }]}>View more</Text>
            </TouchableOpacity>

            {/* Right icons */}
            <View style={styles.bottomActions}>
              {/* Like */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => void handleLike(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isLiked ? '#ef4444' : '#888'}
                />
              </TouchableOpacity>
              {/* Save */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => void handleSave(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={articleIsSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={articleIsSaved ? catColor : '#888'}
                />
              </TouchableOpacity>
              {/* Share */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => void Share.share({ message: item.sourceUrl })}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Source names footer */}
          <Text style={styles.sourceFooter} numberOfLines={1}>
            {item.source}
          </Text>
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
            keyExtractor={(item, index) => `${item.id}-${index}`}
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
      
      {/* Global Explainer Overlay */}
      {activeExplainerId && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 9999 }]}>
          <ExplainerView 
            articleId={activeExplainerId} 
            onClose={() => setActiveExplainerId(null)} 
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Screen chrome ──────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  tabsBar: {
    backgroundColor: 'rgba(0,0,0,0.92)',
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
    fontSize: 15,
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

  // ── Card shell ─────────────────────────────────────────────────────────────
  newsItem: {
    width,
  },

  // ── Image area ─────────────────────────────────────────────────────────────
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  newsImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // BREAKING badge
  breakingBadge: {
    position: 'absolute',
    top: 18,
    left: 18,
    backgroundColor: '#0a0a0f',
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 10,
  },
  breakingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // AI pill (top-right)
  aiPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  aiPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  aiPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Content card ───────────────────────────────────────────────────────────
  contentCard: {
    backgroundColor: '#16161d',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    overflow: 'hidden',
  },

  // Category pill + sources row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  categoryPill: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourcesCount: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },

  // Title
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f0f0f5',
    lineHeight: 25,
    marginBottom: 10,
  },

  // Key takeaway block (blue left border)
  takeawayBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    paddingLeft: 10,
    marginBottom: 10,
  },
  takeawayText: {
    fontSize: 13.5,
    fontStyle: 'italic',
    color: '#b0b8cc',
    lineHeight: 20,
  },

  // Body
  bodyText: {
    fontSize: 14,
    color: '#9a9aaa',
    lineHeight: 21,
    marginBottom: 10,
  },

  // ── Bottom row ─────────────────────────────────────────────────────────────
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f0f0f5',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 4,
  },

  // Sources footer
  sourceFooter: {
    fontSize: 11,
    color: '#555',
    marginTop: 6,
    textAlign: 'right',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // ── Loading / empty states ──────────────────────────────────────────────────
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

