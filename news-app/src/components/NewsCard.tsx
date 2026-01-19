/**
 * NewsCard Component
 * Displays a news article in a card format
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NewsArticle } from '../types';
import { useTheme } from '../utils/hooks';
import { formatRelativeTime } from '../utils/formatters';
import { useBookmarksStore } from '../store';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { toggleBookmark, isBookmarked } = useBookmarksStore();
  const bookmarked = isBookmarked(article.id);
  
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
          source={{ uri: article.imageUrl }}
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
          source={{ uri: article.imageUrl }}
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
        source={{ uri: article.imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.categoryPill, { backgroundColor: theme.colors.backgroundTertiary }]}>
            <Text style={[styles.category, { color: theme.colors.accent }]}>
              {article.category}
            </Text>
          </View>
          <TouchableOpacity onPress={handleBookmark}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={theme.colors.accent}
            />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
          {article.title}
        </Text>
        
        <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {article.description}
        </Text>
        
        <View style={styles.footer}>
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
      </View>
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
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backdropFilter: 'blur(10px)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
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
    backdropFilter: 'blur(10px)',
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
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
  },
  compactMeta: {
    flexDirection: 'row',
  },
  compactMetaText: {
    fontSize: 11,
  },
});

