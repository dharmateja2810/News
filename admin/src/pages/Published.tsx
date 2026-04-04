import { useEffect, useState } from 'react';
import { getPublishedFeed, type PublishedStory } from '../api';

const today = new Date().toISOString().slice(0, 10);

const TIER_LABELS: Record<number, string> = { 1: 'Deep Dive', 2: 'Standard', 3: 'Brief' };
const TIER_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-gray-100 text-gray-600',
};

export default function Published() {
  const [edition, setEdition] = useState('morning');
  const [date, setDate] = useState(today);
  const [stories, setStories] = useState<PublishedStory[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getPublishedFeed(edition, date)
      .then((res) => setStories(res.stories))
      .catch(() => setStories([]));
  }, [edition, date]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Published Feed</h1>
          <p className="text-gray-500 text-sm mt-1">{stories.length} stories</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <select value={edition} onChange={(e) => setEdition(e.target.value)} className="border rounded px-3 py-2 text-sm font-medium">
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      {stories.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
          No published stories for this edition. Approve items in the Editor Queue first.
        </div>
      ) : (
        <div className="space-y-4">
          {stories.map((s) => (
            <div key={s.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-400">#{s.feedRank}</span>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{s.category}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${TIER_COLORS[s.tier] ?? ''}`}>
                        {TIER_LABELS[s.tier] ?? `Tier ${s.tier}`}
                      </span>
                      {s.isBreaking && (
                        <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded">BREAKING</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-gray-900">{s.headline}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{s.summary}</p>
                  </div>
                  <span className="text-gray-400 text-xl">{expanded === s.id ? '−' : '+'}</span>
                </div>
              </div>

              {expanded === s.id && (
                <div className="border-t px-5 py-4 bg-gray-50 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Why it Matters</p>
                    <p className="text-sm text-gray-800">{s.whyMatters}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Double Click</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {s.doubleClick}
                    </div>
                  </div>
                  {s.cluster && (
                    <div className="text-xs text-gray-500">
                      Cluster: {s.cluster.articleCount} articles from {s.cluster.uniqueSourceCount} sources
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
