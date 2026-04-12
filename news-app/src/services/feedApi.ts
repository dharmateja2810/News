/**
 * Feed API — fetches stories from cluster_content
 * Endpoints: /api/feed/latest, /api/feed/story/:id
 */
import { api } from './api';

export interface FeedStory {
  id: string;
  headline: string;
  summary: string;
  whyMatters: string;
  doubleClick: string;
  category: string;
  tier: number;
  feedRank: number | null;
  illustrationId: string | null;
  edition: string;
  publishedAt: string;
  cluster?: {
    id: string;
    topic: string | null;
    uniqueSourceCount: number;
    articleCount: number;
  };
}

export interface FeedStoryDetail extends FeedStory {
  doubleClick: string;
  cluster?: {
    id: string;
    topic: string | null;
    uniqueSourceCount: number;
    articleCount: number;
    articles?: Array<{
      id: string;
      title: string;
      source: string;
      url: string;
      publishedAt: string | null;
    }>;
  };
}

export interface FeedResponse {
  success: boolean;
  count: number;
  stories: FeedStory[];
}

export interface StoryResponse {
  success: boolean;
  story: FeedStoryDetail;
}

/** Get the latest feed ordered by OzScore */
export async function getLatestFeed(): Promise<FeedResponse> {
  const res = await api.get<FeedResponse>('/feed/latest');
  return res.data;
}

/** Get a full story including double_click content */
export async function getStoryDetail(storyId: string): Promise<StoryResponse> {
  const res = await api.get<StoryResponse>(`/feed/story/${storyId}`);
  return res.data;
}

