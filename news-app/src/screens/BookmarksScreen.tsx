/**
 * Bookmarks Screen - Shows Saved Articles
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { NewsDetailModal } from './NewsDetailModal';
import { useTheme } from '../contexts/ThemeContext';

// Import the same news data
const ALL_NEWS = [
  {
    id: '1',
    title: 'AI Breakthrough: New Language Model Surpasses Human Performance',
    description: 'Researchers unveil a revolutionary AI system.',
    imageUrl: 'https://picsum.photos/seed/tech1/400/300',
    source: 'TechCrunch',
    category: 'Technology',
  },
  {
    id: '2',
    title: 'Global Markets Rally as Economic Data Exceeds Expectations',
    description: 'Stock markets worldwide see significant gains.',
    imageUrl: 'https://picsum.photos/seed/business1/400/300',
    source: 'Bloomberg',
    category: 'Business',
  },
  {
    id: '3',
    title: 'Championship Victory: Underdog Team Wins Historic Finals',
    description: 'After trailing for three quarters, underdogs win.',
    imageUrl: 'https://picsum.photos/seed/sports1/400/300',
    source: 'ESPN',
    category: 'Sports',
  },
  {
    id: '4',
    title: 'New Cancer Treatment Shows 90% Success Rate',
    description: 'Revolutionary immunotherapy approach offers hope.',
    imageUrl: 'https://picsum.photos/seed/health1/400/300',
    source: 'Medical News',
    category: 'Health',
  },
  {
    id: '5',
    title: 'Space Telescope Discovers Earth-Like Planets',
    description: 'Astronomers identify potentially habitable worlds.',
    imageUrl: 'https://picsum.photos/seed/science1/400/300',
    source: 'National Geographic',
    category: 'Science',
  },
  {
    id: '6',
    title: 'Electric Vehicle Sales Surge 150% as Battery Technology Improves',
    description: 'New lithium-silicon batteries promise 500-mile range.',
    imageUrl: 'https://picsum.photos/seed/tech2/400/300',
    source: 'TechCrunch',
    category: 'Technology',
  },
  {
    id: '7',
    title: 'Startup Valued at $10 Billion After Revolutionary Healthcare Platform Launch',
    description: 'Healthcare technology company achieves unicorn status.',
    imageUrl: 'https://picsum.photos/seed/business2/400/300',
    source: 'Forbes',
    category: 'Business',
  },
  {
    id: '8',
    title: 'Olympic Committee Announces New Sports for 2028 Games',
    description: 'Breaking, skateboarding, and esports among additions.',
    imageUrl: 'https://picsum.photos/seed/sports2/400/300',
    source: 'ESPN',
    category: 'Sports',
  },
];

export const BookmarksScreen: React.FC = () => {
  const { savedArticleIds, toggleSave } = useSavedArticles();
  const [selectedArticle, setSelectedArticle] = useState<typeof ALL_NEWS[0] | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { colors } = useTheme();
  
  // Filter articles to show only saved ones
  const savedArticles = ALL_NEWS.filter(article => savedArticleIds.has(article.id));
  
  const handleArticlePress = (article: typeof ALL_NEWS[0]) => {
    setSelectedArticle(article);
    setShowDetailModal(true);
  };
  
  const renderSavedArticle = ({ item }: { item: typeof ALL_NEWS[0] }) => (
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
          toggleSave(item.id);
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
      
      {savedArticles.length === 0 ? (
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
