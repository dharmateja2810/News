export interface ClusterInfo {
  id: string;
  topic: string;
  category: string;
  articleCount: number;
  uniqueSourceCount: number;
  ozScore: number;
}

export interface ArticleInfo {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
  category: string;
}

export interface Story {
  id: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  doubleClick: string;
  tier: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  cluster: ClusterInfo & { articles?: ArticleInfo[] };
}

export interface StoriesResponse {
  items: Story[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Stats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}
