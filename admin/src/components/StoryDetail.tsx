import { QueueItem, updateQueueItem, triggerAiGeneration } from '../api';
import StatusBadge from './StatusBadge';
import { useState } from 'react';

interface Props {
  item: QueueItem;
  onClose: () => void;
  onUpdated: () => void;
}

export default function StoryDetail({ item, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [editorHeadline, setEditorHeadline] = useState(item.editorHeadline ?? '');
  const [editorSummary, setEditorSummary] = useState(item.editorSummary ?? '');
  const [editorNotes, setEditorNotes] = useState(item.editorNotes ?? '');

  const action = async (status: string) => {
    setLoading(true);
    try {
      await updateQueueItem(item.id, {
        status,
        editorHeadline: editorHeadline || undefined,
        editorSummary: editorSummary || undefined,
        editorNotes: editorNotes || undefined,
      });
      onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const generateAi = async () => {
    setLoading(true);
    try {
      await triggerAiGeneration(item.id);
      onUpdated();
    } finally {
      setLoading(false);
    }
  };

  const c = item.cluster;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[540px] bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold">Story Detail</h2>
            <p className="text-sm text-gray-500">Rank #{item.suggestedRank}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={item.status} />
            <span className="text-sm font-medium text-blue-600">{c.category}</span>
            <span className="text-sm text-gray-500">OzScore: {c.ozScore.toFixed(2)}</span>
            <span className="text-sm text-gray-500">{c.uniqueSourceCount} source{c.uniqueSourceCount !== 1 ? 's' : ''}</span>
            {c.tier && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">Tier {c.tier}</span>}
          </div>

          {/* Cluster Topic */}
          <div>
            <h3 className="text-base font-bold text-gray-900">{c.topic || 'Untitled cluster'}</h3>
          </div>

          {/* AI Content */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">AI Generated</h4>

            {item.aiHeadline ? (
              <>
                <Field label="Headline" value={item.aiHeadline} />
                <Field label="Summary" value={item.aiSummary} />
                <Field label="Why it Matters" value={item.aiWhyMatters} />
                <Field label="Double Click" value={item.aiDoubleClick} long />
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-800">
                AI content not generated yet.
                <button
                  onClick={generateAi}
                  disabled={loading}
                  className="ml-3 px-3 py-1 bg-yellow-600 text-white rounded text-xs font-semibold hover:bg-yellow-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Now'}
                </button>
              </div>
            )}
          </div>

          {/* Source Articles */}
          {c.articles.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Source Articles</h4>
              <div className="space-y-2">
                {c.articles.map((a) => (
                  <div key={a.id} className="bg-gray-50 rounded p-3 text-sm">
                    <a href={a.url} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                      {a.title}
                    </a>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {a.source} · Authority: {a.sourceAuthority?.toFixed(2) ?? 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Editor Overrides */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Editor Overrides</h4>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Headline</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Override AI headline..."
                value={editorHeadline}
                onChange={(e) => setEditorHeadline(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Summary</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                rows={3}
                placeholder="Override AI summary..."
                value={editorSummary}
                onChange={(e) => setEditorSummary(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                rows={2}
                placeholder="Internal notes..."
                value={editorNotes}
                onChange={(e) => setEditorNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2 border-t">
            <button onClick={() => action('approved')} disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded font-semibold text-sm hover:bg-green-700 disabled:opacity-50">
              Approve
            </button>
            <button onClick={() => action('edited')} disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
              Edit &amp; Approve
            </button>
            <button onClick={() => action('rejected')} disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded font-semibold text-sm hover:bg-red-700 disabled:opacity-50">
              Reject
            </button>
            <button onClick={() => action('deferred')} disabled={loading}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold text-sm hover:bg-gray-400 disabled:opacity-50">
              Defer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, long }: { label: string; value: string | null; long?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <div className={`bg-gray-50 rounded p-3 text-sm text-gray-800 ${long ? 'max-h-60 overflow-y-auto whitespace-pre-wrap' : ''}`}>
        {value}
      </div>
    </div>
  );
}
