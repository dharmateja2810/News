import { useCallback, useEffect, useState } from 'react';
import { api, getPassword, setPassword } from './api';
import type { Stats, Story, StoriesResponse } from './types';

/* ───────── Login screen ───────── */
function Login() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassword(pw);
    try {
      await api.getStats();
      window.location.reload();
    } catch {
      setError('Invalid password');
      setPassword('');
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>OzShorts Editor</h1>
        <input
          type="password"
          placeholder="Editor password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}
        <button className="btn-primary" type="submit">Sign in</button>
      </form>
    </div>
  );
}

/* ───────── Story detail modal ───────── */
function StoryModal({ story, onClose, onAction }: {
  story: Story;
  onClose: () => void;
  onAction: (id: string, status: 'approved' | 'rejected') => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{story.headline}</h2>

        <div className="modal-meta">
          <span className={`badge badge-${story.status}`}>{story.status}</span>
          <span className="badge badge-tier">Tier {story.tier}</span>
          <span className="badge">{story.cluster.category}</span>
          <span className="badge">OzScore {story.cluster.ozScore}</span>
        </div>

        <section>
          <h3>Summary</h3>
          <p>{story.summary}</p>
        </section>

        <section>
          <h3>Why It Matters</h3>
          <p>{story.whyItMatters}</p>
        </section>

        <section>
          <h3>Double Click</h3>
          <p>{story.doubleClick}</p>
        </section>

        {story.cluster.articles && story.cluster.articles.length > 0 && (
          <section>
            <h3>Sources ({story.cluster.articles.length})</h3>
            <ul className="sources-list">
              {story.cluster.articles.map((a) => (
                <li key={a.id}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    {a.title}
                  </a>{' '}
                  — <em>{a.source}</em>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="actions" style={{ marginTop: '1.5rem' }}>
          {story.status !== 'approved' && (
            <button className="btn-approve" onClick={() => onAction(story.id, 'approved')}>
              Approve
            </button>
          )}
          {story.status !== 'rejected' && (
            <button className="btn-reject" onClick={() => onAction(story.id, 'rejected')}>
              Reject
            </button>
          )}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Dashboard ───────── */
type StatusTab = 'pending' | 'approved' | 'rejected';

const CATEGORIES = [
  'Business & Companies',
  'Markets & Economy',
  'Politics & Policy',
  'World News',
  'Tech & Innovation',
  'Property & Housing',
  'Employment & Wages',
  'Lifestyle',
];

function Dashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<StatusTab>('pending');
  const [stories, setStories] = useState<Story[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try { setStats(await api.getStats()); } catch { /* handled by apiFetch */ }
  }, []);

  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const res: StoriesResponse = await api.getStories(tab, page);
      setStories(res.items);
      setTotalPages(res.totalPages);
    } catch { /* handled by apiFetch */ }
    setLoading(false);
  }, [tab, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadStories(); setSelected(new Set()); }, [loadStories]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    await api.updateStatus(id, status);
    setDetail(null);
    loadStats();
    loadStories();
  };

  const handleBulk = async (status: 'approved' | 'rejected') => {
    if (selected.size === 0) return;
    await api.bulkUpdate([...selected], status);
    setSelected(new Set());
    loadStats();
    loadStories();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === stories.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stories.map((s) => s.id)));
    }
  };

  const openDetail = async (id: string) => {
    const full = await api.getStory(id);
    setDetail(full);
  };

  const logout = () => {
    setPassword('');
    window.location.reload();
  };

  return (
    <div className="layout">
      <header>
        <h1>OzShorts Editor</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-primary" onClick={() => onNavigate('create')}>+ Add Story</button>
          <button className="btn-logout" onClick={logout}>Logout</button>
        </div>
      </header>

      {stats && (
        <div className="stats-bar">
          <div className="stat-card">
            <div className="number">{stats.pending}</div>
            <div className="label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="number">{stats.approved}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="number">{stats.rejected}</div>
            <div className="label">Rejected</div>
          </div>
          <div className="stat-card">
            <div className="number">{stats.total}</div>
            <div className="label">Total</div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="tabs">
          {(['pending', 'approved', 'rejected'] as StatusTab[]).map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); setPage(1); }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="bulk-actions">
          {selected.size > 0 && (
            <>
              <span>{selected.size} selected</span>
              {tab !== 'approved' && (
                <button className="btn-approve" onClick={() => handleBulk('approved')}>
                  Approve Selected
                </button>
              )}
              {tab !== 'rejected' && (
                <button className="btn-reject" onClick={() => handleBulk('rejected')}>
                  Reject Selected
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input
                type="checkbox"
                checked={stories.length > 0 && selected.size === stories.length}
                onChange={toggleAll}
              />
            </th>
            <th>Story</th>
            <th>Category</th>
            <th>Tier</th>
            <th>OzScore</th>
            <th>Sources</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Loading…</td></tr>
          ) : stories.length === 0 ? (
            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No stories</td></tr>
          ) : (
            stories.map((s) => (
              <tr key={s.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                  />
                </td>
                <td className="headline-cell">
                  <div className="headline" style={{ cursor: 'pointer' }} onClick={() => openDetail(s.id)}>
                    {s.headline}
                  </div>
                  <div className="summary">{s.summary}</div>
                </td>
                <td>{s.cluster.category}</td>
                <td><span className="badge badge-tier">{s.tier}</span></td>
                <td>{s.cluster.ozScore}</td>
                <td>{s.cluster.articleCount}</td>
                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                <td>
                  <div className="actions">
                    {s.status !== 'approved' && (
                      <button className="btn-approve" onClick={() => handleAction(s.id, 'approved')}>✓</button>
                    )}
                    {s.status !== 'rejected' && (
                      <button className="btn-reject" onClick={() => handleAction(s.id, 'rejected')}>✗</button>
                    )}
                    <button onClick={() => openDetail(s.id)}>View</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}

      {detail && (
        <StoryModal
          story={detail}
          onClose={() => setDetail(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}

/* ───────── Create Story screen ───────── */
type TierPreset = 'tier1' | 'tier2-3';

function CreateStory({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [preset, setPreset] = useState<TierPreset | null>(null);
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [doubleClick, setDoubleClick] = useState('');
  const [tier, setTier] = useState(1);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [status, setStatus] = useState<'pending' | 'approved'>('pending');
  const [ozScore, setOzScore] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectPreset = (p: TierPreset) => {
    setPreset(p);
    if (p === 'tier1') {
      setTier(1);
    } else {
      setTier(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createStory({
        headline,
        summary,
        whyItMatters: whyItMatters || undefined,
        doubleClick: doubleClick || undefined,
        tier,
        category,
        status,
        ozScore,
      });
      onNavigate('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create story');
    }
    setSaving(false);
  };

  const logout = () => {
    setPassword('');
    window.location.reload();
  };

  if (!preset) {
    return (
      <div className="layout">
        <header>
          <h1>Add New Story</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onNavigate('dashboard')}>← Back</button>
            <button className="btn-logout" onClick={logout}>Logout</button>
          </div>
        </header>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem' }}>
          <div className="stat-card" style={{ cursor: 'pointer', flex: 1 }} onClick={() => selectPreset('tier1')}>
            <div className="number" style={{ fontSize: '1.25rem' }}>Tier 1</div>
            <div className="label" style={{ marginTop: '0.5rem' }}>Top Story</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Full card with headline, summary, why it matters, and double click deep-dive.
            </p>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer', flex: 1 }} onClick={() => selectPreset('tier2-3')}>
            <div className="number" style={{ fontSize: '1.25rem' }}>Tier 2 / 3</div>
            <div className="label" style={{ marginTop: '0.5rem' }}>Standard Story</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Compact card with headline and summary. Optional why it matters.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <header>
        <h1>Add {preset === 'tier1' ? 'Tier 1' : 'Tier 2/3'} Story</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setPreset(null)}>← Back</button>
          <button className="btn-logout" onClick={logout}>Logout</button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="create-form">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>Headline *</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Enter story headline"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {preset === 'tier2-3' && (
            <div className="form-group" style={{ flex: 1 }}>
              <label>Tier *</label>
              <select value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                <option value={2}>Tier 2</option>
                <option value={3}>Tier 3</option>
              </select>
            </div>
          )}
          <div className="form-group" style={{ flex: 1 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'approved')}>
              <option value="pending">Pending</option>
              <option value="approved">Approved (publish immediately)</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>OzScore (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={ozScore}
              onChange={(e) => setOzScore(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Summary *</label>
          <textarea
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary of the story"
            required
          />
        </div>

        <div className="form-group">
          <label>Why It Matters {preset === 'tier1' ? '*' : '(optional)'}</label>
          <textarea
            rows={3}
            value={whyItMatters}
            onChange={(e) => setWhyItMatters(e.target.value)}
            placeholder="Explain why this story matters to Australians"
            required={preset === 'tier1'}
          />
        </div>

        {(preset === 'tier1') && (
          <div className="form-group">
            <label>Double Click (Deep Dive) *</label>
            <textarea
              rows={6}
              value={doubleClick}
              onChange={(e) => setDoubleClick(e.target.value)}
              placeholder="Extended analysis and context for the story"
              required
            />
          </div>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create Story'}
          </button>
          <button type="button" onClick={() => onNavigate('dashboard')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* ───────── Root ───────── */
function App() {
  const loggedIn = !!getPassword();
  const [screen, setScreen] = useState('dashboard');

  if (!loggedIn) return <Login />;
  if (screen === 'create') return <CreateStory onNavigate={setScreen} />;
  return <Dashboard onNavigate={setScreen} />;
}

export default App;
