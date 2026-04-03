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
import { NewsDetailModal } from './NewsDetailModal';

const SAMPLE_ILLUSTRATION = require('../../assets/icon.png');

const { width, height } = Dimensions.get('window');

const CATEGORIES = [...NEWS_CATEGORIES];

export const HomeScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const [activeExplainerId, setActiveExplainerId] = useState<string | null>(null);
  const [detailArticle, setDetailArticle] = useState<UiArticle | null>(null);
  const { toggleSave: handleSave, isSaved } = useSavedArticles();
  const { colors } = useTheme();
  const lastTapRef = React.useRef<{ [key: string]: number }>({});
  const listRef = React.useRef<FlatList<UiArticle>>(null);

  // Measure the available height for a single "page" so content isn't hidden behind the bottom tab bar.
  const [pageHeight, setPageHeight] = useState(0);
  const imageHeight = Math.round(pageHeight * 0.35);

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
          <Image source={SAMPLE_ILLUSTRATION} style={styles.newsImage} />
          {/* Dark gradient over the image for readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* BREAKING badge – top left */}
          <View style={[styles.breakingBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.breakingText, { color: colors.text }]}>BREAKING</Text>
          </View>

        </View>

        {/* ── CONTENT AREA ── */}
        <View style={[styles.contentCard, { backgroundColor: colors.surface }]}>
          {/* Category pill + sources/time */}
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { borderColor: catColor }]}>
              <Text style={[styles.categoryPillText, { color: catColor }]}>
                {item.category.toUpperCase()}
              </Text>
            </View>
            <View style={styles.likeRow}>
              <Ionicons name="newspaper-outline" size={12} color={colors.textTertiary} />
              <Text style={[styles.sourcesCount, { color: colors.textTertiary }]}>{sourcesLabel}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={3}>
            {item.title}
          </Text>

          {/* Key takeaway */}
          {keyTakeaway.length > 0 && (
            <View style={styles.takeawayBlock}>
              <Text style={[styles.takeawayText, { color: colors.textSecondary }]} numberOfLines={3}>
                {keyTakeaway}
              </Text>
            </View>
          )}

          {/* Body text */}
          {bodyText.length > 0 && (
            <Text style={[styles.bodyText, { color: colors.textSecondary }]} numberOfLines={10}>
              {bodyText}
            </Text>
          )}

          {/* Icons row — right after description */}
          <View style={[styles.bottomRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.viewMoreBtn, { backgroundColor: colors.backgroundTertiary }]}
              onPress={() => setDetailArticle(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.text} />
              <Text style={[styles.viewMoreText, { color: colors.text }]}>View more</Text>
            </TouchableOpacity>

            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => void handleLike(item.id)} activeOpacity={0.7}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#ef4444' : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => void handleSave(item.id)} activeOpacity={0.7}>
                <Ionicons name={articleIsSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={articleIsSaved ? catColor : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => void Share.share({ message: item.sourceUrl })} activeOpacity={0.7}>
                <Ionicons name="share-outline" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sourceFooter, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.source}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top category tabs (Inshorts-style) */}
      <SafeAreaView edges={['top']} style={[styles.tabsBar, { backgroundColor: colors.surface }]}>
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
                    { color: active ? colors.accent : colors.textTertiary },
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
        {pageHeight === 0 || (isLoading && articles.length === 0) ? (
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

      {detailArticle && (
        <NewsDetailModal
          visible={true}
          article={{
            id: detailArticle.id,
            title: detailArticle.title,
            description: detailArticle.body || detailArticle.title,
            imageUrl: detailArticle.imageUrl || '',
            source: detailArticle.source,
            category: detailArticle.category,
            sourceUrl: detailArticle.sourceUrl,
          }}
          onClose={() => setDetailArticle(null)}
        />
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

  // ── Content card ───────────────────────────────────────────────────────────
  contentCard: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
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
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
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

