/**
 * NewsCard Component
 * Displays a news article in a card format
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NewsArticle } from '../types';
import { useTheme } from '../utils/hooks';
import { formatRelativeTime } from '../utils/formatters';
import { useBookmarksStore } from '../store';
import { LinearGradient } from 'expo-linear-gradient';
import { ExplainerView } from './ExplainerView';

const SAMPLE_ILLUSTRATION = require('../../assets/icon.png');

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

interface NewsCardProps {
  article: NewsArticle;
  onPress: () => void;
  variant?: 'default' | 'featured' | 'compact';
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  onPress,
  variant = 'default',
}) => {
  const theme = useTheme();
  const [showExplainer, setShowExplainer] = useState(false);
  const { toggleBookmark, isBookmarked } = useBookmarksStore();
  const bookmarked = isBookmarked(article.id);

  // Double-tap detection
  const lastTapRef = useRef<number>(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleDoubleClickButton = (e: any) => {
    e.stopPropagation(); // prevent the card's onPress from firing
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Second tap within window — trigger explainer
      lastTapRef.current = 0;
      // Pulse animation feedback
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
      setShowExplainer(true);
    } else {
      // First tap — record time and give subtle press feedback
      lastTapRef.current = now;
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleBookmark = (e: any) => {
    e.stopPropagation();
    toggleBookmark(article.id);
  };
  
  if (variant === 'featured') {
    return (
      <TouchableOpacity
        style={[styles.featuredCard, { backgroundColor: theme.colors.surface }]}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <Image
          source={SAMPLE_ILLUSTRATION}
          style={styles.featuredImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.featuredGradient}
        >
          <View style={styles.featuredContent}>
            <View style={styles.categoryBadge}>
              <Text style={[styles.categoryText, { color: theme.colors.textInverse }]}>
                {article.category}
              </Text>
            </View>
            <Text style={[styles.featuredTitle, { color: theme.colors.textInverse }]} numberOfLines={3}>
              {article.title}
            </Text>
            <View style={styles.featuredMeta}>
              <Text style={[styles.metaText, { color: theme.colors.textInverse }]}>
                {article.source}
              </Text>
              <Text style={[styles.metaText, { color: theme.colors.textInverse }]}>
                {formatRelativeTime(article.publishedDate)}
              </Text>
            </View>
          </View>
        </LinearGradient>
        <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmark}>
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={theme.colors.textInverse}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }
  
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Image
          source={SAMPLE_ILLUSTRATION}
          style={styles.compactImage}
          resizeMode="cover"
        />
        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {article.title}
          </Text>
          <View style={styles.compactMeta}>
            <Text style={[styles.compactMetaText, { color: theme.colors.textSecondary }]}>
              {article.source} • {formatRelativeTime(article.publishedDate)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
  
  // Default variant
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.md]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={SAMPLE_ILLUSTRATION}
        style={styles.image}
        resizeMode="cover"
      />
      
      {/* Magic Double Click Button overlay */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }], ...styles.doubleClickOverlay }}>
        <TouchableOpacity
          onPress={handleDoubleClickButton}
        >
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doubleClickGradient}
          >
            <Ionicons name="sparkles" size={14} color="#FFF" />
            <Text style={styles.doubleClickText}>Double Click</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.titleWrapper}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={3}>
          {article.title}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.bottomRow}>
          <View style={styles.descriptionSide}>
            <View style={[styles.categoryPill, { backgroundColor: theme.colors.backgroundTertiary }]}>
              <Text style={[styles.category, { color: theme.colors.accent }]}>
                {article.category}
              </Text>
            </View>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={3}>
              {article.description}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.source, { color: theme.colors.textSecondary }]}>
                {article.source}
              </Text>
              <Text style={[styles.dot, { color: theme.colors.textTertiary }]}>•</Text>
              <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
                {formatRelativeTime(article.publishedDate)}
              </Text>
            </View>
          </View>
          <View style={styles.iconColumn}>
            <TouchableOpacity onPress={handleBookmark} style={styles.iconBtn}>
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={theme.colors.accent}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {showExplainer && (
        <View style={{...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999}}>
          <ExplainerView articleId={article.id} onClose={() => setShowExplainer(false)} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Default Card Styles
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
  },
  doubleClickOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 100,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  doubleClickGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  doubleClickText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  titleWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  bottomRow: {
    flexDirection: 'row',
  },
  descriptionSide: {
    flex: 1,
    marginRight: 12,
  },
  iconColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    gap: 14,
  },
  iconBtn: {
    padding: 4,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  source: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  time: {
    fontSize: 12,
  },
  
  // Featured Card Styles
  featuredCard: {
    width: CARD_WIDTH,
    height: 400,
    borderRadius: 20,
    marginHorizontal: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
  },
  featuredContent: {
    padding: 20,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 12,
  },
  featuredMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 8,
  },
  
  // Compact Card Styles
  compactCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  compactImage: {
    width: 100,
    height: 100,
  },
  compactContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 4,
  },
  compactMeta: {
    flexDirection: 'row',
  },
  compactMetaText: {
    fontSize: 11,
  },
});

