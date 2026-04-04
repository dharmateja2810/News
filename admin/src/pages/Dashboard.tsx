import { useEffect, useState } from 'react';
import { getQueueStats, buildFeed, publishEdition, triggerScrape, type QueueStats } from '../api';
import StatsCard from '../components/StatsCard';

const today = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const [edition, setEdition] = useState('morning');
  const [date, setDate] = useState(today);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await getQueueStats(edition, date);
      setStats(res.stats);
    } catch (e: any) {
      setMsg('Failed to load stats: ' + e.message);
    }
  };

  useEffect(() => { load(); }, [edition, date]);

  const act = async (label: string, fn: () => Promise<any>) => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fn();
      setMsg(`${label}: ${JSON.stringify(res)}`);
      await load();
    } catch (e: any) {
      setMsg(`${label} failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Pipeline overview and quick actions</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <select
            value={edition}
            onChange={(e) => setEdition(e.target.value)}
            className="border rounded px-3 py-2 text-sm font-medium"
          >
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatsCard label="Total" value={stats.total} />
          <StatsCard label="Pending" value={stats.pending} color="bg-yellow-50" />
          <StatsCard label="Approved" value={stats.approved} color="bg-green-50" />
          <StatsCard label="Edited" value={stats.edited} color="bg-blue-50" />
          <StatsCard label="Rejected" value={stats.rejected} color="bg-red-50" />
          <StatsCard label="Deferred" value={stats.deferred} color="bg-gray-100" />
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => act('Scrape', triggerScrape)}
            disabled={loading}
            className="px-4 py-2 bg-gray-800 text-white rounded font-medium text-sm hover:bg-gray-900 disabled:opacity-50"
          >
            Scrape All Sources
          </button>
          <button
            onClick={() => act('Build Feed', () => buildFeed(edition))}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Build {edition.charAt(0).toUpperCase() + edition.slice(1)} Feed
          </button>
          <button
            onClick={() => act('Publish', () => publishEdition(edition, date))}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Publish All Approved
          </button>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <pre className="bg-gray-800 text-green-400 rounded p-4 text-xs overflow-x-auto whitespace-pre-wrap">
          {msg}
        </pre>
      )}
    </div>
  );
}
