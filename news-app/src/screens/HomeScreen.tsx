/**
 * Home Screen - Main news feed
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../utils/hooks';
import { useNewsStore } from '../store';
import { NewsService } from '../services/newsService';
import { NewsCard, LoadingSpinner, EmptyState, CategoryChip } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG, NEWS_CATEGORIES } from '../constants/appConfig';

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  
  const {
    articles,
    selectedCategory,
    isLoading,
    isRefreshing,
    hasMore,
    currentPage,
    setArticles,
    addArticles,
    setSelectedCategory,
    setLoading,
    setRefreshing,
    setHasMore,
    setCurrentPage,
  } = useNewsStore();
  
  const [featuredArticle, setFeaturedArticle] = useState<any>(null);
  
  // Load initial news
  useEffect(() => {
    loadNews(true);
  }, [selectedCategory]);
  
  const loadNews = async (refresh: boolean = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setCurrentPage(1);
      } else {
        setLoading(true);
      }
      
      const page = refresh ? 1 : currentPage;
      console.log('[HomeScreen] Fetching news, page:', page, 'category:', selectedCategory);
      const response = await NewsService.fetchNews(page, selectedCategory);
      console.log('[HomeScreen] Got articles:', response.items.length, 'First title:', response.items[0]?.title);
      
      if (refresh) {
        setArticles(response.items);
        if (response.items.length > 0) {
          setFeaturedArticle(response.items[0]);
        }
      } else {
        addArticles(response.items);
      }
      
      setHasMore(response.hasMore);
      if (!refresh) {
        setCurrentPage(page + 1);
      }
    } catch (error) {
      console.error('[HomeScreen] Error loading news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    loadNews(true);
  };
  
  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadNews(false);
    }
  };
  
  const handleCategoryChange = (category: typeof NEWS_CATEGORIES[number]) => {
    setSelectedCategory(category);
  };
  
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
            Good {getTimeOfDay()}
          </Text>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {APP_CONFIG.APP_NAME}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: theme.colors.backgroundSecondary }]}
          onPress={() => {}}
        >
          <Ionicons name="search" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
      
      {/* Category Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={NEWS_CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <CategoryChip
            category={item}
            isSelected={item === selectedCategory}
            onPress={() => handleCategoryChange(item)}
          />
        )}
        contentContainerStyle={styles.categories}
      />
      
      {/* Featured Article */}
      {featuredArticle && selectedCategory === 'All' && (
        <View style={styles.featuredSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Featured
          </Text>
          <NewsCard
            article={featuredArticle}
            onPress={() => {}}
            variant="featured"
          />
        </View>
      )}
      
      {/* Latest Section Title */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {selectedCategory === 'All' ? 'Latest News' : selectedCategory}
      </Text>
    </View>
  );
  
  const renderFooter = () => {
    if (!isLoading || isRefreshing) return null;
    return <LoadingSpinner />;
  };
  
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  };
  
  if (isLoading && articles.length === 0) {
    return <LoadingSpinner fullScreen message="Loading news..." />;
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={articles.slice(1)} // Skip first article if it's featured
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NewsCard
            article={item}
            onPress={() => {}}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <EmptyState
            icon="newspaper-outline"
            title="No News Found"
            message="Try selecting a different category or pull to refresh"
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 8,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  featuredSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 16,
  },
});

