/**
 * News Service
 * Handles fetching news articles (currently using mock data)
 */

import { NewsArticle, PaginatedResponse } from '../types';
import { NewsCategory, APP_CONFIG } from '../constants/appConfig';
import { MOCK_ARTICLES } from './mockData';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class NewsService {
  /**
   * Fetch news articles with pagination and filtering
   */
  static async fetchNews(
    page: number = 1,
    category: NewsCategory = 'All',
    searchQuery?: string
  ): Promise<PaginatedResponse<NewsArticle>> {
    // Simulate network delay
    await delay(800);
    
    // Filter articles by category
    let filteredArticles = category === 'All' 
      ? MOCK_ARTICLES 
      : MOCK_ARTICLES.filter(article => article.category === category);
    
    // Filter by search query if provided
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredArticles = filteredArticles.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.description.toLowerCase().includes(query) ||
        article.source.toLowerCase().includes(query)
      );
    }
    
    // Paginate results
    const perPage = APP_CONFIG.NEWS_PER_PAGE;
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const items = filteredArticles.slice(startIndex, endIndex);
    const hasMore = endIndex < filteredArticles.length;
    
    return {
      items,
      total: filteredArticles.length,
      page,
      perPage,
      hasMore,
    };
  }
  
  /**
   * Fetch a single article by ID
   */
  static async fetchArticleById(id: string): Promise<NewsArticle | null> {
    await delay(300);
    return MOCK_ARTICLES.find(article => article.id === id) || null;
  }
  
  /**
   * Get trending/featured articles
   */
  static async fetchTrendingNews(limit: number = 5): Promise<NewsArticle[]> {
    await delay(500);
    return MOCK_ARTICLES.slice(0, limit);
  }
  
  /**
   * Get articles by IDs (for bookmarks)
   */
  static async fetchArticlesByIds(ids: string[]): Promise<NewsArticle[]> {
    await delay(400);
    return MOCK_ARTICLES.filter(article => ids.includes(article.id));
  }
}

