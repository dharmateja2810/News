/**
 * News Service
 * Handles fetching news articles (backend API)
 */

import { NewsArticle, PaginatedResponse } from '../types';
import { NewsCategory, APP_CONFIG } from '../constants/appConfig';
import { api } from './api';

type BackendArticle = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  imageUrl: string | null;
  source: string;
  category: string;
  author: string | null;
  publishedAt: string | null;
  url: string;
  createdAt: string;
};

type ArticlesListResponse = {
  articles: BackendArticle[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

const mapBackendToNewsArticle = (a: BackendArticle): NewsArticle => {
  const publishedDate = a.publishedAt || a.createdAt;
  return {
    id: a.id,
    title: a.title,
    description: a.description || '',
    content: a.content || undefined,
    sourceUrl: a.url,
    imageUrl: a.imageUrl || FALLBACK_IMAGE,
    source: a.source,
    author: a.author || undefined,
    category: (a.category as NewsCategory) || 'All',
    publishedDate,
    createdAt: a.createdAt,
  };
};

export class NewsService {
  /**
   * Fetch news articles with pagination and filtering
   */
  static async fetchNews(
    page: number = 1,
    category: NewsCategory = 'All',
    searchQuery?: string
  ): Promise<PaginatedResponse<NewsArticle>> {
    const perPage = APP_CONFIG.NEWS_PER_PAGE;

    const res = await api.get<ArticlesListResponse>('/articles', {
      params: {
        page,
        limit: perPage,
        category: category === 'All' ? undefined : category,
        search: searchQuery?.trim() ? searchQuery.trim() : undefined,
      },
    });

    const items = res.data.articles.map(mapBackendToNewsArticle);
    const hasMore = res.data.pagination.page < res.data.pagination.totalPages;

    return {
      items,
      total: res.data.pagination.total,
      page,
      perPage,
      hasMore,
    };
  }
  
  /**
   * Fetch a single article by ID
   */
  static async fetchArticleById(id: string): Promise<NewsArticle | null> {
    try {
      const res = await api.get<BackendArticle>(`/articles/${id}`);
      return mapBackendToNewsArticle(res.data);
    } catch {
      return null;
    }
  }
  
  /**
   * Get trending/featured articles
   */
  static async fetchTrendingNews(limit: number = 5): Promise<NewsArticle[]> {
    const res = await api.get<ArticlesListResponse>('/articles', {
      params: { page: 1, limit },
    });
    return res.data.articles.map(mapBackendToNewsArticle);
  }
  
  /**
   * Get articles by IDs (for bookmarks)
   */
  static async fetchArticlesByIds(ids: string[]): Promise<NewsArticle[]> {
    const results = await Promise.all(ids.map((id) => NewsService.fetchArticleById(id)));
    return results.filter(Boolean) as NewsArticle[];
  }
}

