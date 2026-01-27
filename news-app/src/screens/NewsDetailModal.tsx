/**
 * News Detail Modal - Full article view
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavedArticles } from '../contexts/SavedArticlesContext';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface NewsDetailModalProps {
  visible: boolean;
  article: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    source: string;
    category: string;
    time?: string;
    sourceUrl?: string;
  } | null;
  onClose: () => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({
  visible,
  article,
  onClose,
}) => {
  const { toggleSave, isSaved } = useSavedArticles();
  const { colors } = useTheme();
  
  if (!article) return null;
  
  const articleIsSaved = isSaved(article.id);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Image */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: article.imageUrl }} style={styles.image} />
            
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            
            {/* Save Button */}
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={() => void toggleSave(article.id)}
            >
              <Ionicons 
                name={articleIsSaved ? 'bookmark' : 'bookmark-outline'} 
                size={28} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
          
          {/* Content */}
          <View style={styles.content}>
            {/* Category */}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{article.category}</Text>
            </View>
            
            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>{article.title}</Text>
            
            {/* Meta */}
            <View style={styles.meta}>
              <Text style={[styles.source, { color: colors.textSecondary }]}>{article.source}</Text>
              {article.time && (
                <>
                  <Text style={[styles.dot, { color: colors.border }]}>•</Text>
                  <Text style={[styles.time, { color: colors.textSecondary }]}>{article.time}</Text>
                </>
              )}
            </View>
            
            {/* Description */}
            <Text style={[styles.description, { color: colors.text }]}>{article.description}</Text>

            {!!article.sourceUrl && (
              <TouchableOpacity
                style={[styles.openButton, { backgroundColor: colors.accent }]}
                onPress={() => void Linking.openURL(article.sourceUrl!)}
              >
                <Text style={styles.openButtonText}>Open original</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: height * 0.4,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f4c75',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
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
    lineHeight: 32,
    marginBottom: 16,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  description: {
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
  },
  openButton: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  openButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});

