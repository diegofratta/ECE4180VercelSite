// Term management (Wave 4). Admin-only page for creating terms,
// activating a term, and (eventually) handing off to Wave 5's purge ops.
//
// The "active term" drives what every new write gets stamped with. So
// flipping the pointer here is the single action that marks "we're now
// writing into Fall 2026 instead of Spring 2026".

import React, { useEffect, useMemo, useState } from 'react';
import {
  Term,
  TermListResponse,
} from '../types';
import {
  TERM_ID_RE,
  activateTerm,
  createTerm,
  deleteTerm,
  describeTerm,
  fetchAllTerms,
  updateTerm,
} from '../utils/terms';

type Toast = { kind: 'ok' | 'err'; msg: string };

const TermsPage: React.FC = () => {
  const [data, setData] = useState<TermListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Create form
  const [newTermId, setNewTermId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [activateOnCreate, setActivateOnCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Per-row busy state
  const [busy, setBusy] = useState<Record<string, 'idle' | 'activating' | 'deleting' | 'editing'>>({});

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAllTerms();
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-fill displayName from termId (sp26 -> "Spring 2026").
  useEffect(() => {
    if (!newDisplayName && TERM_ID_RE.test(newTermId)) {
      setNewDisplayName(describeTerm(newTermId));
    }
  }, [newTermId, newDisplayName]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const termId = newTermId.trim().toLowerCase();
    if (!TERM_ID_RE.test(termId)) {
      setToast({ kind: 'err', msg: 'Term ID must look like sp26, fa27, wi28…' });
      return;
    }
    try {
      setCreating(true);
      await createTerm({
        termId,
        displayName: newDisplayName.trim() || describeTerm(termId),
        startDate: newStartDate || undefined,
        endDate: newEndDate || undefined,
        activate: activateOnCreate,
      });
      setToast({
        kind: 'ok',
        msg: activateOnCreate
          ? `${termId} created and activated`
          : `${termId} created (status: upcoming)`,
      });
      setNewTermId('');
      setNewDisplayName('');
      setNewStartDate('');
      setNewEndDate('');
      setActivateOnCreate(false);
      await refresh();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setCreating(false);
    }
  }

  async function handleActivate(t: Term) {
    if (t.isActive) return;
    if (!window.confirm(
      `Activate ${t.termId}? All new writes (checkoffs, submissions, etc.) will be stamped with this term. The previously active term is archived.`
    )) return;
    try {
      setBusy((s) => ({ ...s, [t.termId]: 'activating' }));
      await activateTerm(t.termId);
      setToast({ kind: 'ok', msg: `Activated ${t.termId}` });
      await refresh();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setBusy((s) => ({ ...s, [t.termId]: 'idle' }));
    }
  }

  async function handleDelete(t: Term) {
    if (t.isActive) {
      setToast({ kind: 'err', msg: 'Activate a different term before deleting this one.' });
      return;
    }
    if (!window.confirm(`Delete term registry entry "${t.termId}"? (This does NOT delete term data — use the Wave 5 purge page for that.)`)) return;
    try {
      setBusy((s) => ({ ...s, [t.termId]: 'deleting' }));
      await deleteTerm(t.termId);
      setToast({ kind: 'ok', msg: `${t.termId} removed from registry` });
      await refresh();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setBusy((s) => ({ ...s, [t.termId]: 'idle' }));
    }
  }

  async function handleStatusChange(t: Term, status: Term['status']) {
    if (status === t.status) return;
    try {
      setBusy((s) => ({ ...s, [t.termId]: 'editing' }));
      await updateTerm(t.termId, { status });
      setToast({ kind: 'ok', msg: `${t.termId} status → ${status}` });
      await refresh();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setBusy((s) => ({ ...s, [t.termId]: 'idle' }));
    }
  }

  const activeTerm = useMemo(() => data?.terms.find((t) => t.isActive) || null, [data]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-secondary-700 dark:text-white">Term management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create terms (e.g. <code>sp26</code>, <code>fa26</code>) and activate the current one.
          Every checkoff, submission, grade, and audit entry gets stamped with the active term at write time.
        </p>
      </div>

      {/* Active term callout */}
      <div className="card p-5 mb-6 border-l-4 border-l-gt-gold">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Currently active</div>
            <div className="mt-1 text-2xl font-display font-bold text-secondary-700 dark:text-white">
              {activeTerm ? activeTerm.displayName : 'No active term set'}
            </div>
            {activeTerm && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                <code>{activeTerm.termId}</code>
                {activeTerm.startDate && ` · ${activeTerm.startDate}`}
                {activeTerm.endDate && ` → ${activeTerm.endDate}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="card p-5 mb-6">
        <div className="mb-3 font-semibold text-secondary-700 dark:text-white">Create a new term</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Term ID
            </label>
            <input
              type="text"
              value={newTermId}
              onChange={(e) => setNewTermId(e.target.value.toLowerCase())}
              placeholder="sp26"
              pattern="(sp|su|fa|wi)[0-9]{2}"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
              disabled={creating}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Display name
            </label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Spring 2026"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              disabled={creating}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Start date
            </label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              disabled={creating}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              End date
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              disabled={creating}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={activateOnCreate}
              onChange={(e) => setActivateOnCreate(e.target.checked)}
              disabled={creating}
            />
            Activate on create (flip new writes to this term immediately)
          </label>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create term'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {toast && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            toast.kind === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Other terms table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Term</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading…</td></tr>
            ) : (data?.terms || []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No terms yet. Create one above.</td></tr>
            ) : (
              (data?.terms || []).map((t) => {
                const rowBusy = busy[t.termId] || 'idle';
                return (
                  <tr key={t.termId} className={`border-t border-gray-200 dark:border-gray-800 ${t.isActive ? 'bg-gt-gold/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {t.displayName}
                        {t.isActive && (
                          <span className="ml-2 text-xs font-semibold text-gt-gold uppercase tracking-wide">active</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400"><code>{t.termId}</code></div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">
                      {(t.startDate || '?')} {t.endDate ? `→ ${t.endDate}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t, e.target.value as Term['status'])}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                        disabled={rowBusy !== 'idle' || t.isActive /* active is managed by the pointer, not freely edited */}
                      >
                        <option value="upcoming">upcoming</option>
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!t.isActive && (
                        <button
                          onClick={() => handleActivate(t)}
                          disabled={rowBusy !== 'idle'}
                          className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 mr-2"
                        >
                          {rowBusy === 'activating' ? '…' : 'Activate'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={rowBusy !== 'idle' || t.isActive}
                        className="text-xs px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        title={t.isActive ? 'Cannot delete the active term' : ''}
                      >
                        {rowBusy === 'deleting' ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        <strong>Heads-up:</strong> Deleting a term here only removes its registry row, and is blocked if the term still
        has students, labs, or submissions. The full "clean out everything from last semester" workflow comes in Wave 5
        (dry-run → archive → purge).
      </div>
    </div>
  );
};

export default TermsPage;
