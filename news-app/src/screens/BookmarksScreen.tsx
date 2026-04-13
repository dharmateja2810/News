/**
 * Bookmarks Screen — HomeScreen-style full-page cards for saved articles
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { listBookmarks } from '../services/bookmarksApi';
import type { BackendArticle } from '../services/articlesApi';
import { getStoryDetail } from '../services/feedApi';
import type { FeedStoryDetail } from '../services/feedApi';
import { PlaceholderIllustration } from '../components/PlaceholderIllustration';

const { width } = Dimensions.get('window');

// ── Card item (same shape as HomeScreen) ────────────────────────────────────

interface CardItem {
  id: string;
  headline: string;
  summary: string;
  whyMatters: string;
  doubleClick: string;
  category: string;
  tier: number;
  sourceCount: number;
  source: string;
  time: string;
  storyId?: string;
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

function articleToCard(a: BackendArticle): CardItem {
  const cc = a.cluster?.clusterContent;
  if (cc) {
    return {
      id: a.id,
      headline: cc.headline,
      summary: cc.summary,
      whyMatters: cc.whyItMatters || '',
      doubleClick: cc.doubleClick || '',
      category: a.category,
      tier: cc.tier,
      sourceCount: a.cluster?.uniqueSourceCount ?? 1,
      source: a.cluster?.topic ?? a.source,
      time: formatRelativeTime(a.publishedAt),
      storyId: cc.id,
    };
  }
  const sentences = (a.description || '').match(/[^.!?]+[.!?]+/g) || [];
  return {
    id: a.id,
    headline: a.title,
    summary: sentences.slice(0, 3).join(' ').trim() || a.description?.slice(0, 300) || '',
    whyMatters: '',
    doubleClick: a.content || a.description || '',
    category: a.category,
    tier: 2,
    sourceCount: 1,
    source: a.source,
    time: formatRelativeTime(a.publishedAt),
  };
}

const TIER_LABELS: Record<number, string> = { 1: 'DEEP DIVE', 2: 'STANDARD', 3: 'BRIEF' };

// ─────────────────────────────────────────────────────────────────────────────

export const BookmarksScreen: React.FC = () => {
  const { savedArticleIds, toggleSave: handleSave, isSaved } = useSavedArticles();
  const { token } = useAuth();
  const { colors } = useTheme();
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const lastTapRef = useRef<{ [key: string]: number }>({});
  const listRef = useRef<FlatList<CardItem>>(null);

  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const imageHeight = Math.round(pageHeight * 0.32);

  // Double-click detail state
  const [detailStory, setDetailStory] = useState<FeedStoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    if (!token) {
      setCards([]);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const bookmarked = await listBookmarks();
        const uniqueById = Array.from(
          new Map(bookmarked.map((a) => [a.id, a])).values(),
        );
        setCards(uniqueById.map(articleToCard));
      } catch (error) {
        console.error('Error loading saved articles:', error);
        setCards([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [savedArticleIds, token]);

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
      setDetailStory({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        whyMatters: item.whyMatters,
        doubleClick: item.doubleClick || item.summary,
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
    if (now - last < 300) void openDoubleClick(item);
    lastTapRef.current[item.id] = now;
  };

  // ── Card renderer (same as HomeScreen) ──────────────────────────────────

  const renderCard = ({ item }: { item: CardItem }) => {
    const isLiked = likedArticles.has(item.id);
    const saved = isSaved(item.id);
    const tierLabel = TIER_LABELS[item.tier] ?? 'STANDARD';
    const hasWhyMatters = item.tier === 1 && item.whyMatters.length > 0;

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => hasWhyMatters && handleDoubleTap(item)}
        style={[styles.newsItem, { height: pageHeight }]}
      >
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <PlaceholderIllustration width={width} height={imageHeight} category={item.category} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.tierBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.tierText}>{tierLabel}</Text>
          </View>
          {item.sourceCount > 1 && (
            <View style={styles.sourceCountBadge}>
              <Ionicons name="layers-outline" size={12} color="#fff" />
              <Text style={styles.sourceCountText}>{item.sourceCount} sources</Text>
            </View>
          )}
        </View>

        <View style={[styles.contentCard, { backgroundColor: colors.surface, flex: 1 }]}>
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}>
              <Text style={[styles.categoryPillText, { color: colors.accent }]}>{item.category.toUpperCase()}</Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>{item.time}</Text>
          </View>

          <Text style={[styles.headline, { color: colors.text }]} numberOfLines={3}>{item.headline}</Text>
          <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={hasWhyMatters ? 7 : 15}>
            {hasWhyMatters ? item.summary : (item.doubleClick || item.summary)}
          </Text>

          {hasWhyMatters && (
            <View style={[styles.whyMattersBlock, { borderLeftColor: colors.accent }]}>
              <Text style={[styles.whyMattersLabel, { color: colors.accent }]}>WHY IT MATTERS</Text>
              <Text style={[styles.whyMattersText, { color: colors.textSecondary }]} numberOfLines={3}>{item.whyMatters}</Text>
            </View>
          )}

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
            ) : <View />}
            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleLike(item.id)} activeOpacity={0.7}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#ef4444' : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => void handleSave(item.id)} activeOpacity={0.7}>
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

  // ── Double Click modal (same as HomeScreen) ─────────────────────────────

  const renderDetailModal = () => {
    if (!detailVisible) return null;
    const story = detailStory;
    const catColor = colors.accent;

    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <SafeAreaView edges={['top']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setDetailVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Double Click</Text>
              <View style={{ width: 28 }} />
            </View>
          </SafeAreaView>
          {detailLoading ? (
            <View style={styles.loadingCenter}><ActivityIndicator size="large" color={colors.accent} /></View>
          ) : story ? (
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.metaRow}>
                <View style={[styles.categoryPill, { backgroundColor: catColor + '18', borderColor: catColor }]}>
                  <Text style={[styles.categoryPillText, { color: catColor }]}>{story.category.toUpperCase()}</Text>
                </View>
                <View style={[styles.tierPillModal, { backgroundColor: colors.backgroundTertiary }]}>
                  <Text style={[styles.tierPillText, { color: colors.textSecondary }]}>{TIER_LABELS[story.tier] ?? 'STANDARD'}</Text>
                </View>
              </View>
              <Text style={[styles.modalHeadline, { color: colors.text }]}>{story.headline}</Text>
              <Text style={[styles.modalSummary, { color: colors.textSecondary }]}>{story.summary}</Text>
              {story.tier === 1 && story.whyMatters && story.whyMatters.length > 0 && (
                <View style={[styles.whyMattersBlock, { borderLeftColor: catColor }]}>
                  <Text style={[styles.whyMattersLabel, { color: catColor }]}>WHY IT MATTERS</Text>
                  <Text style={[styles.modalBodyText, { color: colors.textSecondary }]}>{story.whyMatters}</Text>
                </View>
              )}
              <View style={[styles.doubleClickSection, { backgroundColor: colors.surfaceSecondary ?? colors.surface }]}>
                <View style={styles.doubleClickHeader}>
                  <Ionicons name="layers" size={18} color={catColor} />
                  <Text style={[styles.doubleClickTitle, { color: colors.text }]}>The Full Story</Text>
                </View>
                <Text style={[styles.modalBodyText, { color: colors.text }]}>{story.doubleClick}</Text>
              </View>
              {story.cluster?.articles && story.cluster.articles.length > 0 && (
                <View style={styles.sourcesSection}>
                  <Text style={[styles.sourcesTitle, { color: colors.textTertiary }]}>SOURCES ({story.cluster.articles.length})</Text>
                  {story.cluster.articles.map((art) => (
                    <View key={art.id} style={[styles.sourceItem, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.sourceItemTitle, { color: colors.text }]} numberOfLines={2}>{art.title}</Text>
                      <Text style={[styles.sourceItemMeta, { color: colors.textTertiary }]}>{art.source}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.loadingCenter}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Could not load story details.</Text>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // ── Empty / auth states ────────────────────────────────────────────────

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

  if (cards.length === 0) {
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

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Saved Articles</Text>
          <Text style={[styles.headerCount, { color: colors.textSecondary }]}>{cards.length} saved</Text>
        </View>
      </SafeAreaView>

      {/* Full-page paging cards */}
      <View
        style={styles.listArea}
        onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0) setPageHeight(h); }}
      >
        {pageHeight === 0 ? (
          <View style={styles.emptyState}><ActivityIndicator size="large" color={colors.accent} /></View>
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
            getItemLayout={(_data, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          />
        )}
      </View>

      {renderDetailModal()}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerCount: { fontSize: 14, marginTop: 2 },
  listArea: { flex: 1 },

  // Card
  newsItem: { width },
  imageContainer: { width: '100%', overflow: 'hidden' },
  tierBadge: { position: 'absolute', top: 14, right: 14, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  tierText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  sourceCountBadge: {
    position: 'absolute', bottom: 10, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  sourceCountText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1 },
  viewMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  viewMoreText: { fontSize: 13, fontWeight: '700' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },

  // Empty states
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // Loading
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
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
