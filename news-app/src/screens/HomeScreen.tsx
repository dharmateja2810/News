/**
 * Home Screen — OzShorts spec-compliant card layout
 *
 * Card shows: Illustration, Headline, Summary, "Why it matters",
 *             Category pill, Tier badge, Source count
 * Double tap / "View more": opens the Double Click explainer
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Share,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { useTheme } from '../contexts/ThemeContext';
import { listArticles, mapArticleToUi } from '../services/articlesApi';
import type { UiArticle } from '../services/articlesApi';
import { getLatestFeed, getStoryDetail } from '../services/feedApi';
import type { FeedStory, FeedStoryDetail } from '../services/feedApi';
import { APP_CONFIG, NEWS_CATEGORIES } from '../constants/appConfig';
import { PlaceholderIllustration } from '../components/PlaceholderIllustration';
const { width } = Dimensions.get('window');
const CATEGORIES = [...NEWS_CATEGORIES];

// ── Unified card item shape ─────────────────────────────────────────────────

interface CardItem {
  id: string;
  articleId: string;
  headline: string;
  summary: string;
  whyMatters: string;
  doubleClick: string;
  category: string;
  tier: number;
  sourceCount: number;
  source: string;
  time: string;
  sourceUrl: string;
  /** cluster_content id for double-click detail */
  storyId?: string;
}

/** Map a FeedStory to CardItem */
function feedStoryToCard(s: FeedStory): CardItem {
  return {
    id: s.id,
    articleId: s.leadArticleId || s.id,
    headline: s.headline,
    summary: s.summary,
    whyMatters: s.whyMatters || '',
    doubleClick: s.doubleClick || '',
    category: s.category,
    tier: s.tier,
    sourceCount: s.cluster?.uniqueSourceCount ?? 1,
    source: s.cluster?.topic ?? s.category,
    time: formatRelativeTime(s.publishedAt),
    sourceUrl: '',
    storyId: s.id,
  };
}

/** Map a raw UiArticle (fallback) to CardItem */
function articleToCard(a: UiArticle): CardItem {
  const sentences = (a.description || '').match(/[^.!?]+[.!?]+/g) || [];
  const summary = sentences.slice(0, 3).join(' ').trim() || a.description?.slice(0, 300) || '';
  const whyMatters = sentences.slice(3, 6).join(' ').trim();
  // Use up to ~800 chars of the article body as the "doubleClick" body for non-whyMatters display
  const doubleClick = sentences.length > 6
    ? sentences.slice(0, 15).join(' ').trim()
    : a.description?.slice(0, 800) || '';
  return {
    id: a.id,
    articleId: a.id,
    headline: a.title,
    summary,
    whyMatters,
    doubleClick,
    category: a.category,
    tier: 2,
    sourceCount: 1,
    source: a.source,
    time: a.time,
    sourceUrl: a.sourceUrl,
  };
}

function formatRelativeTime(dateIso?: string | null): string {
  if (!dateIso) return '';
  const ts = new Date(dateIso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Tier labels ─────────────────────────────────────────────────────────────

const TIER_LABELS: Record<number, string> = {
  1: 'DEEP DIVE',
  2: 'STANDARD',
  3: 'BRIEF',
};

// ─────────────────────────────────────────────────────────────────────────────

export const HomeScreen: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const { toggleSave: handleSave, isSaved } = useSavedArticles();
  const { colors } = useTheme();
  const lastTapRef = React.useRef<{ [key: string]: number }>({});
  const listRef = React.useRef<FlatList<CardItem>>(null);

  const [pageHeight, setPageHeight] = useState(0);
  const imageHeight = Math.round(pageHeight * 0.32);

  const [cards, setCards] = useState<CardItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Double-click detail state
  const [detailStory, setDetailStory] = useState<FeedStoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try published feed first
      const feedRes = await getLatestFeed();
      if (feedRes.stories && feedRes.stories.length > 0) {
        let items = feedRes.stories.map(feedStoryToCard);
        if (selectedCategory !== 'All') {
          items = items.filter((c) => c.category === selectedCategory);
        }
        setCards(items);
        return;
      }
    } catch {
      // Feed not available yet — fall back to articles
    }

    // Fallback: raw articles
    try {
      const res = await listArticles({
        page: 1,
        limit: 50,
        category: selectedCategory === 'All' ? undefined : selectedCategory,
      });
      setCards(res.articles.map(mapArticleToUi).map(articleToCard));
    } catch {
      setCards([]);
    }
  }, [selectedCategory]);

  const refresh = async () => {
    setIsRefreshing(true);
    await loadFeed();
    setIsRefreshing(false);
  };

  useEffect(() => {
    setCurrentIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    loadFeed().finally(() => setIsLoading(false));
  }, [loadFeed]);

  // ── Interactions ──────────────────────────────────────────────────────────

  const handleLike = (id: string) => {
    setLikedArticles((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const openDoubleClick = async (item: CardItem) => {
    if (item.storyId) {
      setDetailLoading(true);
      setDetailVisible(true);
      try {
        const res = await getStoryDetail(item.storyId);
        setDetailStory(res.story);
      } catch {
        setDetailStory(null);
      } finally {
        setDetailLoading(false);
      }
    } else {
      // No published story — show what we have in a simple modal
      setDetailStory({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        whyMatters: item.whyMatters,
        doubleClick: item.doubleClick || item.summary + (item.whyMatters ? `\n\n${item.whyMatters}` : ''),
        category: item.category,
        tier: item.tier,
        feedRank: null,
        illustrationId: null,
        edition: 'latest',
        publishedAt: new Date().toISOString(),
      });
      setDetailVisible(true);
    }
  };

  const handleDoubleTap = (item: CardItem) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] || 0;
    if (now - last < 300) {
      void openDoubleClick(item);
    }
    lastTapRef.current[item.id] = now;
  };

  const onViewableItemsChanged = React.useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // ── Card renderer ─────────────────────────────────────────────────────────

  const renderCard = ({ item }: { item: CardItem }) => {
    const isLiked = likedArticles.has(item.articleId);
    const saved = isSaved(item.articleId);
    const tierLabel = TIER_LABELS[item.tier] ?? 'STANDARD';

    const hasWhyMatters = item.tier === 1 && item.whyMatters.length > 0;

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hasWhyMatters && handleDoubleTap(item)}
        style={[styles.newsItem, { height: pageHeight }]}
      >
        {/* ── ILLUSTRATION ── */}
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <PlaceholderIllustration width={width} height={imageHeight} category={item.category} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Tier badge — top right */}
          <View style={[styles.tierBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.tierText}>{tierLabel}</Text>
          </View>

          {/* Source count — bottom of image */}
          {item.sourceCount > 1 && (
            <View style={styles.sourceCountBadge}>
              <Ionicons name="layers-outline" size={12} color="#fff" />
              <Text style={styles.sourceCountText}>{item.sourceCount} sources</Text>
            </View>
          )}
        </View>

        {/* ── CONTENT ── */}
        <View style={[styles.contentCard, { backgroundColor: colors.surface, flex: 1 }]}>
          {/* Category pill + time */}
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}>
              <Text style={[styles.categoryPillText, { color: colors.accent }]}>
                {item.category.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
              {item.time}
            </Text>
          </View>

          {/* Headline */}
          <Text style={[styles.headline, { color: colors.text }]} numberOfLines={3}>
            {item.headline}
          </Text>

          {/* Summary / explainer body */}
          <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={hasWhyMatters ? 7 : 15}>
            {hasWhyMatters ? item.summary : (item.doubleClick || item.summary)}
          </Text>

          {/* Why it matters */}
          {hasWhyMatters && (
            <View style={[styles.whyMattersBlock, { borderLeftColor: colors.accent }]}>
              <Text style={[styles.whyMattersLabel, { color: colors.accent }]}>WHY IT MATTERS</Text>
              <Text style={[styles.whyMattersText, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.whyMatters}
              </Text>
            </View>
          )}

          {/* Bottom actions */}
          <View style={[styles.bottomRow, { borderTopColor: colors.border }]}>
            {hasWhyMatters ? (
              <TouchableOpacity
                style={[styles.viewMoreBtn, { backgroundColor: colors.accent + '20' }]}
                onPress={() => void openDoubleClick(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="layers-outline" size={14} color={colors.accent} />
                <Text style={[styles.viewMoreText, { color: colors.accent }]}>Read More</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleLike(item.articleId)} activeOpacity={0.7}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#ef4444' : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => void handleSave(item.articleId)} activeOpacity={0.7}>
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.accent : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => void Share.share({ message: item.headline })} activeOpacity={0.7}>
                <Ionicons name="share-outline" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Double Click detail modal ─────────────────────────────────────────────

  const renderDetailModal = () => {
    if (!detailVisible) return null;

    const story = detailStory;
    const catColor = colors.accent;

    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <SafeAreaView edges={['top']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setDetailVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Read More</Text>
              <View style={{ width: 28 }} />
            </View>
          </SafeAreaView>

          {detailLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : story ? (
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {/* Category + Tier */}
              <View style={styles.metaRow}>
                <View style={[styles.categoryPill, { backgroundColor: catColor + '18', borderColor: catColor }]}>
                  <Text style={[styles.categoryPillText, { color: catColor }]}>{story.category.toUpperCase()}</Text>
                </View>
                <View style={[styles.tierPillModal, { backgroundColor: colors.backgroundTertiary }]}>
                  <Text style={[styles.tierPillText, { color: colors.textSecondary }]}>
                    {TIER_LABELS[story.tier] ?? 'STANDARD'}
                  </Text>
                </View>
              </View>

              {/* Headline */}
              <Text style={[styles.modalHeadline, { color: colors.text }]}>{story.headline}</Text>

              {/* Summary */}
              <Text style={[styles.modalSummary, { color: colors.textSecondary }]}>{story.summary}</Text>

              {/* Full Story content */}
              <View style={[styles.doubleClickSection, { backgroundColor: colors.surfaceSecondary ?? colors.surface }]}>
                <View style={styles.doubleClickHeader}>
                  <Ionicons name="layers" size={18} color={catColor} />
                  <Text style={[styles.doubleClickTitle, { color: colors.text }]}>The Full Story</Text>
                </View>
                <Text style={[styles.modalBodyText, { color: colors.text }]}>{story.doubleClick}</Text>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.loading}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Could not load story details.</Text>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Category tabs */}
      <SafeAreaView edges={['top']} style={[styles.tabsBar, { backgroundColor: colors.surface }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
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
                <Text style={[styles.tabText, { color: active ? colors.accent : colors.textTertiary }]}>
                  {category === 'All' ? 'My Feed' : category}
                </Text>
                {active && <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Card list */}
      <View
        style={styles.listArea}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setPageHeight(h);
        }}
      >
        {pageHeight === 0 || (isLoading && cards.length === 0) ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading feed...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={cards}
            renderItem={renderCard}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={pageHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_data, index) => ({
              length: pageHeight,
              offset: pageHeight * index,
              index,
            })}
            refreshing={isRefreshing}
            onRefresh={refresh}
            ListEmptyComponent={
              <View style={styles.loading}>
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>No stories yet.</Text>
                <TouchableOpacity onPress={() => void refresh()} style={[styles.retryButton, { borderColor: colors.border }]}>
                  <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      {/* Double Click modal */}
      {renderDetailModal()}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabsBar: {},
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 18, alignItems: 'center' },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, fontWeight: '700' },
  tabUnderline: { marginTop: 6, height: 3, width: 26, borderRadius: 3 },
  listArea: { flex: 1 },

  // Card
  newsItem: { width },
  imageContainer: { width: '100%', overflow: 'hidden' },

  // Tier
  tierBadge: {
    position: 'absolute', top: 14, right: 14,
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4,
  },
  tierText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // Source count
  sourceCountBadge: {
    position: 'absolute', bottom: 10, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sourceCountText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Content
  contentCard: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  categoryPill: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  categoryPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  timeText: { fontSize: 12, fontWeight: '500' },

  headline: { fontSize: 19, fontWeight: '800', lineHeight: 26, marginBottom: 8 },
  summary: { fontSize: 14, lineHeight: 21, marginBottom: 10 },

  whyMattersBlock: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 10, paddingVertical: 4 },
  whyMattersLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  whyMattersText: { fontSize: 13, lineHeight: 19 },

  // Bottom row
  bottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1,
  },
  viewMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  viewMoreText: { fontSize: 13, fontWeight: '700' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },

  // Loading
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  retryButton: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { fontWeight: '700' },

  // ── Double Click Modal ──────────────────────────────────────────────────
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  modalCloseBtn: { padding: 4 },
  modalHeaderTitle: { fontSize: 17, fontWeight: '700' },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 20 },
  modalHeadline: { fontSize: 22, fontWeight: '800', lineHeight: 30, marginBottom: 12 },
  modalSummary: { fontSize: 15, lineHeight: 23, marginBottom: 16 },
  modalBodyText: { fontSize: 15, lineHeight: 24 },

  doubleClickSection: { borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 16 },
  doubleClickHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  doubleClickTitle: { fontSize: 16, fontWeight: '700' },

  sourcesSection: { marginTop: 8 },
  sourcesTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  sourceItem: { paddingVertical: 10, borderBottomWidth: 1 },
  sourceItemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  sourceItemMeta: { fontSize: 12 },

  tierPillModal: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  tierPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});
