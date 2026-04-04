import { useEffect, useState } from 'react';
import { getQueue, updateQueueItem, triggerAiGeneration, type QueueItem } from '../api';
import StatusBadge from '../components/StatusBadge';
import StoryDetail from '../components/StoryDetail';

const today = new Date().toISOString().slice(0, 10);

export default function Queue() {
  const [edition, setEdition] = useState('morning');
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getQueue(edition, date);
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [edition, date]);

  const quickAction = async (id: string, status: string) => {
    await updateQueueItem(id, { status });
    await load();
  };

  const quickGenerate = async (id: string) => {
    try {
      await triggerAiGeneration(id);
      await load();
    } catch (e: any) {
      alert('AI generation failed: ' + e.message);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editor Queue</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} items</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <select value={edition} onChange={(e) => setEdition(e.target.value)} className="border rounded px-3 py-2 text-sm font-medium">
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Headline</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">OzScore</th>
              <th className="px-4 py-3 text-center">Sources</th>
              <th className="px-4 py-3 text-center">AI</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => setSelected(item)}
              >
                <td className="px-4 py-3 text-gray-500 font-mono">{item.suggestedRank}</td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                  {item.aiHeadline || item.cluster.topic || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {item.cluster.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.cluster.ozScore.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">{item.cluster.uniqueSourceCount}</td>
                <td className="px-4 py-3 text-center">
                  {item.aiHeadline ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); quickGenerate(item.id); }}
                      className="text-xs text-yellow-600 hover:text-yellow-800 font-medium"
                    >
                      Generate
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {item.status === 'pending' && (
                      <>
                        <button onClick={() => quickAction(item.id, 'approved')} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">
                          ✓
                        </button>
                        <button onClick={() => quickAction(item.id, 'rejected')} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium">
                          ✗
                        </button>
                        <button onClick={() => quickAction(item.id, 'deferred')} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-medium">
                          ⏸
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No queue items. Try building a feed from the Dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail slide-over */}
      {selected && (
        <StoryDetail
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
