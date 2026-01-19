/**
 * Home Screen - Simple Version
 * Just a working news feed with mock data
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';

// Simple mock news data
const MOCK_NEWS = [
  {
    id: '1',
    title: 'AI Breakthrough: New Language Model Surpasses Human Performance',
    description: 'Researchers unveil a revolutionary AI system that demonstrates unprecedented understanding of complex reasoning tasks.',
    imageUrl: 'https://picsum.photos/seed/tech1/800/600',
    source: 'TechCrunch',
    category: 'Technology',
    time: '2 hours ago',
  },
  {
    id: '2',
    title: 'Global Markets Rally as Economic Data Exceeds Expectations',
    description: 'Stock markets worldwide see significant gains following positive employment and inflation reports.',
    imageUrl: 'https://picsum.photos/seed/business1/800/600',
    source: 'Bloomberg',
    category: 'Business',
    time: '4 hours ago',
  },
  {
    id: '3',
    title: 'Championship Victory: Underdog Team Wins Historic Finals',
    description: 'After trailing for three quarters, the underdogs mount an incredible comeback to claim the title.',
    imageUrl: 'https://picsum.photos/seed/sports1/800/600',
    source: 'ESPN',
    category: 'Sports',
    time: '6 hours ago',
  },
  {
    id: '4',
    title: 'New Cancer Treatment Shows 90% Success Rate in Clinical Trials',
    description: 'Revolutionary immunotherapy approach offers hope for patients with previously untreatable cancers.',
    imageUrl: 'https://picsum.photos/seed/health1/800/600',
    source: 'Medical News Today',
    category: 'Health',
    time: '8 hours ago',
  },
  {
    id: '5',
    title: 'Space Telescope Discovers Earth-Like Planets in Nearby Star System',
    description: 'Astronomers identify potentially habitable worlds just 40 light-years from our solar system.',
    imageUrl: 'https://picsum.photos/seed/science1/800/600',
    source: 'National Geographic',
    category: 'Science',
    time: '10 hours ago',
  },
];

const CATEGORIES = ['All', 'Technology', 'Business', 'Sports', 'Health', 'Science'];

export const HomeScreenSimple: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  
  const filteredNews = selectedCategory === 'All' 
    ? MOCK_NEWS 
    : MOCK_NEWS.filter(item => item.category === selectedCategory);
  
  const handleRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };
  
  const renderNewsCard = ({ item }: { item: typeof MOCK_NEWS[0] }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9}>
      <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.footer}>
          <Text style={styles.source}>{item.source}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DailyDigest</Text>
        <Text style={styles.headerSubtitle}>Your Daily News, Curated</Text>
      </View>
      
      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categories}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* News Feed */}
      <FlatList
        data={filteredNews}
        renderItem={renderNewsCard}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#606060',
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categories: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f6fa',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#0f4c75',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#606060',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  cardContent: {
    padding: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f4c75',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#606060',
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  source: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f4c75',
  },
  time: {
    fontSize: 12,
    color: '#909090',
  },
});

