const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Editor Queue ────────────────────────────────────────────────────────────

export interface QueueItem {
  id: string;
  clusterId: string;
  edition: string;
  editionDate: string;
  suggestedRank: number | null;
  aiHeadline: string | null;
  aiSummary: string | null;
  aiWhyMatters: string | null;
  aiDoubleClick: string | null;
  aiImagePrompt: string | null;
  status: string;
  editorHeadline: string | null;
  editorSummary: string | null;
  editorNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  cluster: {
    id: string;
    topic: string | null;
    category: string | null;
    ozScore: number;
    ozScoreMorning: number;
    ozScoreEvening: number;
    impactScore: number | null;
    uniqueSourceCount: number;
    articleCount: number;
    clusterQuality: number;
    tier: number | null;
    articles: Array<{
      id: string;
      title: string;
      source: string;
      url: string;
      publishedAt: string | null;
      sourceAuthority: number | null;
    }>;
  };
}

export interface QueueStats {
  total: number;
  pending: number;
  approved: number;
  edited: number;
  rejected: number;
  deferred: number;
}

export async function getQueue(edition: string, date: string) {
  return request<{ success: boolean; count: number; items: QueueItem[] }>(
    `/editor/queue?edition=${edition}&date=${date}`,
  );
}

export async function getQueueStats(edition: string, date: string) {
  return request<{ success: boolean; stats: QueueStats }>(
    `/editor/queue/stats?edition=${edition}&date=${date}`,
  );
}

export async function updateQueueItem(
  id: string,
  data: {
    status?: string;
    editorHeadline?: string;
    editorSummary?: string;
    editorNotes?: string;
  },
) {
  return request<{ success: boolean; item: QueueItem }>(
    `/editor/queue/${id}`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export async function triggerAiGeneration(id: string) {
  return request<{ success: boolean; item: QueueItem }>(
    `/editor/queue/${id}/generate`,
    { method: 'POST' },
  );
}

// ── Feed ────────────────────────────────────────────────────────────────────

export async function buildFeed(edition: string) {
  return request<{ success: boolean; edition: string; shortlisted: number }>(
    `/feed/build?edition=${edition}`,
    { method: 'POST' },
  );
}

export interface PublishedStory {
  id: string;
  headline: string;
  summary: string;
  whyMatters: string;
  doubleClick: string;
  category: string;
  tier: number;
  feedRank: number | null;
  isBreaking: boolean;
  edition: string;
  editionDate: string;
  publishedAt: string;
  cluster?: {
    id: string;
    topic: string | null;
    uniqueSourceCount: number;
    articleCount: number;
  };
}

export async function getPublishedFeed(edition: string, date: string) {
  return request<{ success: boolean; count: number; stories: PublishedStory[] }>(
    `/feed?edition=${edition}&date=${date}`,
  );
}

// ── Publisher ───────────────────────────────────────────────────────────────

export async function publishSingle(queueId: string) {
  return request<{ success: boolean; story: PublishedStory }>(
    `/publisher/queue/${queueId}/publish`,
    { method: 'POST' },
  );
}

export async function publishEdition(edition: string, date: string) {
  return request<{ success: boolean; count: number; stories: PublishedStory[] }>(
    `/publisher/edition/publish?edition=${edition}&date=${date}`,
    { method: 'POST' },
  );
}

// ── Scraper ─────────────────────────────────────────────────────────────────

export async function triggerScrape() {
  return request<{ success: boolean; totalArticlesInserted: number }>(
    `/admin/scrape`,
    { method: 'POST' },
  );
}
