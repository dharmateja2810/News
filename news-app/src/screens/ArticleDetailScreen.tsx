/**
 * Article Detail Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  SafeAreaView,
  StatusBar,
  Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ArticleDetailScreenRouteProp } from '../navigation/types';
import { useTheme } from '../utils/hooks';
import { useBookmarksStore } from '../store';
import { formatDate } from '../utils/formatters';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const ArticleDetailScreen: React.FC = () => {
  const route = useRoute<ArticleDetailScreenRouteProp>();
  const navigation = useNavigation();
  const theme = useTheme();
  const { article } = route.params;
  
  const { toggleBookmark, isBookmarked } = useBookmarksStore();
  const bookmarked = isBookmarked(article.id);
  
  const handleShare = async () => {
    try {
      await Share.share({
        message: `${article.title}\n\n${article.sourceUrl}`,
        title: article.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };
  
  const handleOpenSource = () => {
    Linking.openURL(article.sourceUrl);
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          />
          
          {/* Header Buttons */}
          <SafeAreaView style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.headerButton, styles.blurButton]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerButtonsRight}>
              <TouchableOpacity
                style={[styles.headerButton, styles.blurButton]}
                onPress={() => toggleBookmark(article.id)}
              >
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.headerButton, styles.blurButton]} 
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: theme.colors.accent + '20' }]}>
            <Text style={[styles.categoryText, { color: theme.colors.accent }]}>
              {article.category}
            </Text>
          </View>
          
          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {article.title}
          </Text>
          
          {/* Meta Information */}
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Ionicons name="newspaper-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                {article.source}
              </Text>
            </View>
            
            {article.author && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                  {article.author}
                </Text>
              </View>
            )}
            
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                {formatDate(article.publishedDate)}
              </Text>
            </View>
          </View>
          
          {/* Description */}
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {article.description}
          </Text>
          
          {/* Content */}
          <Text style={[styles.body, { color: theme.colors.text }]}>
            {article.content || article.description}
          </Text>
          
          {/* Read Full Article Button */}
          <TouchableOpacity
            style={[styles.sourceButton, { backgroundColor: theme.colors.accent }]}
            onPress={handleOpenSource}
          >
            <Text style={[styles.sourceButtonText, { color: theme.colors.textInverse }]}>
              Read Full Article
            </Text>
            <Ionicons name="open-outline" size={20} color={theme.colors.textInverse} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroContainer: {
    height: 400,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  headerButtons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerButton: {
    marginHorizontal: 4,
  },
  blurButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerButtonsRight: {
    flexDirection: 'row',
  },
  content: {
    padding: 20,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 16,
  },
  meta: {
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    marginLeft: 8,
  },
  description: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 20,
    fontWeight: '500',
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 32,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  sourceButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
});

