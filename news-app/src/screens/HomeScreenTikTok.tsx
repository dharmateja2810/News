/**
 * Home Screen - TikTok Style
 * Full-screen vertical scrolling news feed
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

// Simple mock news data
const ALL_NEWS = [
  {
    id: '1',
    title: 'AI Breakthrough: New Language Model Surpasses Human Performance',
    description: 'Researchers have unveiled a revolutionary artificial intelligence system that demonstrates unprecedented understanding of complex reasoning tasks. The new model, trained on diverse datasets, shows remarkable capabilities in understanding context, solving mathematical problems, and generating human-like responses. This breakthrough is expected to transform industries from healthcare to education.',
    imageUrl: 'https://picsum.photos/seed/tech1/1080/1920',
    source: 'TechCrunch',
    category: 'Technology',
    time: '2 hours ago',
  },
  {
    id: '2',
    title: 'Global Markets Rally as Economic Data Exceeds Expectations',
    description: 'Stock markets worldwide experienced significant gains following the release of better-than-expected employment and inflation reports. Major indices reached new highs as investors showed renewed confidence in economic recovery. Analysts suggest this positive trend could continue as central banks maintain supportive monetary policies.',
    imageUrl: 'https://picsum.photos/seed/business1/1080/1920',
    source: 'Bloomberg',
    category: 'Business',
    time: '4 hours ago',
  },
  {
    id: '3',
    title: 'Championship Victory: Underdog Team Wins Historic Finals',
    description: 'In one of the most thrilling championship games in recent memory, the underdog team mounted an incredible comeback after trailing for three quarters. With an electrifying final quarter performance, they secured a historic victory that will be remembered for years. Fans celebrated in the streets as their team defied all odds.',
    imageUrl: 'https://picsum.photos/seed/sports1/1080/1920',
    source: 'ESPN',
    category: 'Sports',
    time: '6 hours ago',
  },
  {
    id: '4',
    title: 'New Cancer Treatment Shows 90% Success Rate in Clinical Trials',
    description: 'A groundbreaking immunotherapy approach has demonstrated a 90% success rate in recent clinical trials, offering hope to patients with previously untreatable cancers. The treatment works by enhancing the body\'s immune system to target cancer cells more effectively. Medical experts are calling it a potential game-changer in oncology.',
    imageUrl: 'https://picsum.photos/seed/health1/1080/1920',
    source: 'Medical News Today',
    category: 'Health',
    time: '8 hours ago',
  },
  {
    id: '5',
    title: 'Space Telescope Discovers Earth-Like Planets in Nearby Star System',
    description: 'Astronomers using advanced space telescope technology have identified potentially habitable worlds located just 40 light-years from Earth. The planets orbit within the habitable zone of their star, where conditions might support liquid water. This discovery brings us closer to answering the age-old question: are we alone in the universe?',
    imageUrl: 'https://picsum.photos/seed/science1/1080/1920',
    source: 'National Geographic',
    category: 'Science',
    time: '10 hours ago',
  },
  {
    id: '6',
    title: 'Electric Vehicle Sales Surge 150% as Battery Technology Improves',
    description: 'The electric vehicle market is experiencing explosive growth with sales increasing by 150% year-over-year. New lithium-silicon battery technology promises ranges of over 500 miles on a single charge, addressing one of the main concerns of potential EV buyers. Industry experts predict electric vehicles will dominate the market within the next decade.',
    imageUrl: 'https://picsum.photos/seed/tech2/1080/1920',
    source: 'TechCrunch',
    category: 'Technology',
    time: '12 hours ago',
  },
  {
    id: '7',
    title: 'Startup Valued at $10 Billion After Revolutionary Healthcare Platform Launch',
    description: 'A healthcare technology startup has achieved unicorn status with a valuation of $10 billion following the successful launch of its AI-powered diagnostic platform. The system uses machine learning to analyze medical images and patient data, helping doctors make faster and more accurate diagnoses. Major hospital networks are already implementing the technology.',
    imageUrl: 'https://picsum.photos/seed/business2/1080/1920',
    source: 'Forbes',
    category: 'Business',
    time: '14 hours ago',
  },
  {
    id: '8',
    title: 'Olympic Committee Announces New Sports for 2028 Games',
    description: 'In an effort to modernize and attract younger audiences, the International Olympic Committee has announced the addition of several new sports for the 2028 Games. Breaking, skateboarding, and competitive esports are among the additions. This marks a significant shift in the Olympic movement toward embracing contemporary athletic competitions.',
    imageUrl: 'https://picsum.photos/seed/sports2/1080/1920',
    source: 'ESPN',
    category: 'Sports',
    time: '16 hours ago',
  },
];

const CATEGORIES = ['All', 'Technology', 'Business', 'Sports', 'Health', 'Science'];

export const HomeScreenTikTok: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const { toggleSave: handleSave, isSaved } = useSavedArticles();
  const { colors } = useTheme();
  const lastTapRef = React.useRef<{ [key: string]: number }>({});
  
  const filteredNews = selectedCategory === 'All' 
    ? ALL_NEWS 
    : ALL_NEWS.filter(item => item.category === selectedCategory);
  
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
      // Double tap detected - toggle like
      handleLike(articleId);
    }
    lastTapRef.current[articleId] = now;
  };
  
  const renderNewsItem = ({ item }: { item: typeof ALL_NEWS[0] }) => {
    const isLiked = likedArticles.has(item.id);
    const articleIsSaved = isSaved(item.id);
    // Generate random like count for demo
    const likeCount = Math.floor(Math.random() * 10000) + 100;
    
    return (
      <View style={styles.newsItem}>
        {/* Top Half - Image */}
        <TouchableOpacity 
          style={styles.imageContainer}
          activeOpacity={1}
          onPress={() => handleDoubleTap(item.id)}
        >
          <Image source={{ uri: item.imageUrl }} style={styles.newsImage} />
        </TouchableOpacity>
        
        {/* Bottom Half - Content */}
        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          
          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          
          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={4}>
            {item.description}
          </Text>
          
          {/* Meta Info */}
          <View style={styles.meta}>
            <Text style={[styles.source, { color: colors.textSecondary }]}>{item.source}</Text>
            <Text style={[styles.dot, { color: colors.border }]}>•</Text>
            <Text style={[styles.time, { color: colors.textSecondary }]}>{item.time}</Text>
          </View>
        </View>
        
        {/* Instagram-Style Right Side Actions */}
        <View style={styles.rightActions}>
          {/* Like Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={isLiked ? 'heart' : 'heart-outline'} 
              size={32} 
              color={isLiked ? '#ff4444' : colors.text} 
            />
            <Text style={[styles.actionCount, { color: colors.text }]}>
              {isLiked ? likeCount + 1 : likeCount}
            </Text>
          </TouchableOpacity>
          
          {/* Save/Bookmark Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSave(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={articleIsSaved ? 'bookmark' : 'bookmark-outline'} 
              size={32} 
              color={articleIsSaved ? '#0f4c75' : colors.text}
            />
            <Text style={[styles.actionCount, { color: colors.text }]}>Save</Text>
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="share-outline" 
              size={32} 
              color={colors.text} 
            />
            <Text style={[styles.actionCount, { color: colors.text }]}>Share</Text>
          </TouchableOpacity>
        </View>
        
        {/* Three Dots Menu - Top Right */}
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setShowFilterModal(true)}
        >
          <View style={[styles.menuDot, { backgroundColor: colors.text }]} />
          <View style={[styles.menuDot, { backgroundColor: colors.text }]} />
          <View style={[styles.menuDot, { backgroundColor: colors.text }]} />
        </TouchableOpacity>
        
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {filteredNews.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                { backgroundColor: colors.textSecondary },
                index === currentIndex && { backgroundColor: colors.text },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Full-Screen Vertical Scroll */}
      <FlatList
        data={filteredNews}
        renderItem={renderNewsItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />
      
      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.categoryList}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryOption,
                    selectedCategory === category && styles.categoryOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setShowFilterModal(false);
                    setCurrentIndex(0);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      selectedCategory === category && styles.categoryOptionTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                  {selectedCategory === category && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  newsItem: {
    width,
    height,
  },
  imageContainer: {
    height: height * 0.5,
    width: '100%',
  },
  newsImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    height: height * 0.5,
    padding: 20,
    paddingRight: 80,
    paddingBottom: 100,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f4c75',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    lineHeight: 32,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  source: {
    fontSize: 14,
    fontWeight: '600',
  },
  dot: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  time: {
    fontSize: 14,
  },
  menuButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginVertical: 2,
  },
  progressContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    gap: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressDotActive: {
    width: 20,
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    top: height * 0.5 + 20,
    alignItems: 'center',
    gap: 24,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: height * 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  modalClose: {
    fontSize: 28,
    color: '#606060',
    fontWeight: '300',
  },
  categoryList: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f5f6fa',
  },
  categoryOptionActive: {
    backgroundColor: '#0f4c75',
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  categoryOptionTextActive: {
    color: '#fff',
  },
  checkmark: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
});

