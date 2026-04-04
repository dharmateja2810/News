/**
 * Feed API — fetches published stories (not raw articles)
 * Matches the OzShorts spec: /api/feed/latest, /api/feed/story/:id, /api/feed/breaking
 */
import { api } from './api';

export interface FeedStory {
  id: string;
  headline: string;
  summary: string;
  whyMatters: string;
  category: string;
  tier: number;
  feedRank: number | null;
  illustrationId: string | null;
  isBreaking: boolean;
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

/** Get the most recently published feed */
export async function getLatestFeed(): Promise<FeedResponse> {
  const res = await api.get<FeedResponse>('/feed/latest');
  return res.data;
}

/** Get feed for a specific edition and date */
export async function getFeed(edition: string, date: string): Promise<FeedResponse> {
  const res = await api.get<FeedResponse>('/feed', { params: { edition, date } });
  return res.data;
}

/** Get a full story including double_click content */
export async function getStoryDetail(storyId: string): Promise<StoryResponse> {
  const res = await api.get<StoryResponse>(`/feed/story/${storyId}`);
  return res.data;
}

/** Get today's breaking stories */
export async function getBreakingStories(): Promise<FeedResponse> {
  const res = await api.get<FeedResponse>('/feed/breaking');
  return res.data;
}
