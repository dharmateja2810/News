/**
 * Bookmarks API
 */
import { api } from './api';
import type { BackendArticle } from './articlesApi';

export async function toggleBookmark(articleId: string): Promise<{ bookmarked: boolean }> {
  const res = await api.post<{ bookmarked: boolean }>(`/bookmarks/${articleId}`);
  return res.data;
}

export async function listBookmarks(): Promise<BackendArticle[]> {
  const res = await api.get<BackendArticle[]>('/bookmarks');
  return res.data;
}

export async function toggleLike(articleId: string): Promise<{ liked: boolean }> {
  const res = await api.post<{ liked: boolean }>(`/bookmarks/like/${articleId}`);
  return res.data;
}


