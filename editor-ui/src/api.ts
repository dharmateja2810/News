import type { Stats, StoriesResponse, Story } from './types';

const PASSWORD_KEY = 'editor_password';

export function getPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || '';
}

export function setPassword(pw: string) {
  localStorage.setItem(PASSWORD_KEY, pw);
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-editor-password': getPassword(),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(PASSWORD_KEY);
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getStats: (): Promise<Stats> => apiFetch('/api/editor/stats'),

  getStories: (status = 'pending', page = 1, limit = 20): Promise<StoriesResponse> =>
    apiFetch(`/api/editor/stories?status=${status}&page=${page}&limit=${limit}`),

  getStory: (id: string): Promise<Story> => apiFetch(`/api/editor/stories/${id}`),

  updateStatus: (id: string, status: 'approved' | 'rejected') =>
    apiFetch(`/api/editor/stories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  bulkUpdate: (ids: string[], status: 'approved' | 'rejected') =>
    apiFetch('/api/editor/stories/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, status }),
    }),

  createStory: (data: {
    headline: string;
    summary: string;
    whyItMatters?: string;
    doubleClick?: string;
    tier: number;
    category: string;
    status?: string;
    ozScore?: number;
  }): Promise<Story> =>
    apiFetch('/api/editor/stories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
