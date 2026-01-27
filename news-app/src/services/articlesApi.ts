/**
 * Articles API + mapping to simple UI shape
 */
import { api } from './api';

export interface BackendArticle {
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
  updatedAt: string;
  _count?: {
    likes: number;
    bookmarks: number;
  };
}

export interface ArticlesListResponse {
  articles: BackendArticle[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface UiArticle {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  source: string;
  category: string;
  time: string;
  sourceUrl: string;
  publishedAt?: string | null;
  likeCount?: number;
  bookmarkCount?: number;
}

function formatRelativeTime(dateIso?: string | null): string {
  if (!dateIso) return '';
  const ts = new Date(dateIso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

export function mapArticleToUi(a: BackendArticle): UiArticle {
  const published = a.publishedAt || a.createdAt;
  return {
    id: a.id,
    title: a.title,
    // Prefer full content when available so the detail view has enough text.
    description: a.content || a.description || '',
    imageUrl: a.imageUrl || FALLBACK_IMAGE,
    source: a.source,
    category: a.category,
    time: formatRelativeTime(published),
    sourceUrl: a.url,
    publishedAt: a.publishedAt,
    likeCount: a._count?.likes ?? 0,
    bookmarkCount: a._count?.bookmarks ?? 0,
  };
}

export async function listArticles(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<ArticlesListResponse> {
  const res = await api.get<ArticlesListResponse>('/articles', { params });
  return res.data;
}

export async function getArticle(id: string): Promise<BackendArticle> {
  const res = await api.get<BackendArticle>(`/articles/${id}`);
  return res.data;
}


