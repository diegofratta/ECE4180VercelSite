// Audit log viewer (Wave 6).
//
// TAs can see this (transparency — the audit log is the record of what every
// grader did), but only admins can export to CSV. Every action route in the
// backend writes an entry; here we expose read + filter + paginated browse.
//
// Filter shape mirrors the backend GET /admin/audit query params exactly, so
// what you see in the URL of an export request is what you filtered on.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin } from '../utils/roles';
import { fetchAllTerms } from '../utils/terms';
import { TermListResponse } from '../types';
import {
  AuditEntry,
  AuditListResponse,
  AuditQueryParams,
  exportAuditCsv,
  fetchAuditActions,
  fetchAuditEntries,
  fetchAuditForStudent,
} from '../utils/audit';

type Toast = { kind: 'ok' | 'err'; msg: string };

// Static source list — the backend doesn't have a /sources endpoint and these
// are baked into the producer sites anyway. Keep in sync with the `source`
// strings in shared/audit.js on the backend.
const KNOWN_SOURCES = [
  'grades-page',
  'video-review',
  'video-review-partner',
  'lab-queue',
  'admin-purge',
  'admin-labs',
  'admin-guides',
  'scheduler',
];

const DEFAULT_LIMIT = 50;

// ---------- Action coloring ----------

type PillColor = 'red' | 'amber' | 'green' | 'slate';

function colorForAction(action: string): PillColor {
  const a = (action || '').toLowerCase();
  // Destructive
  if (a.startsWith('delete-') || a === 'purge-term' || a === 'uncheck' || a === 'dismiss' || a === 'cancel-schedule') {
    return 'red';
  }
  // Cautionary / reversible-but-heavy
  if (a === 'reset-progress' || a === 'schedule-unlock') {
    return 'amber';
  }
  // Success / positive
  if (a === 'check' || a === 'check-partner' || a === 'auto-unlock-lab' || a === 'bulk-unlock') {
    return 'green';
  }
  return 'slate';
}

const PILL_CLASSES: Record<PillColor, string> = {
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  slate: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

// ---------- Time helpers ----------

function relativeTime(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  const diffSec = Math.round((Date.now() - d) / 1000);
  if (diffSec < 0) {
    // Future — shouldn't happen in practice but be graceful.
    const fwd = Math.abs(diffSec);
    if (fwd < 60) return `in ${fwd}s`;
    if (fwd < 3600) return `in ${Math.round(fwd / 60)}m`;
    if (fwd < 86400) return `in ${Math.round(fwd / 3600)}h`;
    return `in ${Math.round(fwd / 86400)}d`;
  }
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

// datetime-local input emits "YYYY-MM-DDTHH:mm" in the user's local tz.
// We need to hand the backend an ISO string (UTC). An empty string means
// "don't filter on this bound", so pass through empty.
function localDateTimeToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

// ---------- Filter shape ----------

interface FilterState {
  actor: string;
  action: string;
  studentId: string;
  source: string;
  term: string;
  since: string; // local datetime string from the input
  until: string;
  // Per-student override tab
  studentSearch: string;
  mode: 'global' | 'per-student';
}

const EMPTY_FILTERS: FilterState = {
  actor: '',
  action: '',
  studentId: '',
  source: '',
  term: '',
  since: '',
  until: '',
  studentSearch: '',
  mode: 'global',
};

function filtersToQuery(f: FilterState): AuditQueryParams {
  return {
    actor: f.actor.trim() || undefined,
    action: f.action || undefined,
    studentId: f.studentId.trim() || undefined,
    source: f.source || undefined,
    term: f.term || undefined,
    since: localDateTimeToIso(f.since),
    until: localDateTimeToIso(f.until),
    limit: DEFAULT_LIMIT,
  };
}

// ---------- Page ----------

const AuditLogViewer: React.FC = () => {
  const { authState } = useAuth();
  const userIsAdmin = isAdmin(authState.user);

  const [toast, setToast] = useState<Toast | null>(null);

  // Filter inputs — held in a single "draft" that we only commit to `active`
  // on Apply so typing doesn't fire a fetch per keystroke.
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [active, setActive] = useState<FilterState>(EMPTY_FILTERS);

  // Results
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded details rows (keyed by logId)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Dropdown data
  const [actions, setActions] = useState<string[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [terms, setTerms] = useState<TermListResponse | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // ---- Effects ----

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Load dropdown data once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setActionsLoading(true);
        const r = await fetchAuditActions();
        if (!cancelled) setActions(r.actions || []);
      } catch (err) {
        if (!cancelled) setToast({ kind: 'err', msg: `Failed to load action list: ${(err as Error).message}` });
      } finally {
        if (!cancelled) setActionsLoading(false);
      }
    })();
    (async () => {
      try {
        const r = await fetchAllTerms();
        if (!cancelled) setTerms(r);
      } catch (err) {
        if (!cancelled) setToast({ kind: 'err', msg: `Failed to load terms: ${(err as Error).message}` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Initial load — fire a fetch with no filters so the table isn't empty on
  // arrival. Users can refine from there.
  useEffect(() => {
    void runFetch(EMPTY_FILTERS, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Fetch ----

  const runFetch = useCallback(
    async (f: FilterState, token: string | null) => {
      const isLoadMore = token !== null;
      try {
        if (isLoadMore) setLoadingMore(true);
        else {
          setLoading(true);
          setEntries([]);
        }
        setError(null);

        let res: AuditListResponse;
        if (f.mode === 'per-student' && f.studentSearch.trim()) {
          const qp = filtersToQuery(f);
          qp.nextToken = token || undefined;
          res = await fetchAuditForStudent(f.studentSearch.trim(), qp);
        } else {
          const qp = filtersToQuery(f);
          qp.nextToken = token || undefined;
          res = await fetchAuditEntries(qp);
        }

        setEntries((prev) => (isLoadMore ? [...prev, ...res.entries] : res.entries));
        setNextToken(res.nextToken);
        setScanMode(res.scanMode);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (isLoadMore) setLoadingMore(false);
        else setLoading(false);
      }
    },
    []
  );

  // ---- Handlers ----

  function handleApply() {
    setActive(draft);
    setExpanded({});
    void runFetch(draft, null);
  }

  function handleClear() {
    setDraft(EMPTY_FILTERS);
    setActive(EMPTY_FILTERS);
    setExpanded({});
    void runFetch(EMPTY_FILTERS, null);
  }

  function handleLoadMore() {
    if (!nextToken) return;
    void runFetch(active, nextToken);
  }

  async function handleExport() {
    if (!userIsAdmin) return;
    const qp = filtersToQuery(active);
    if (!qp.term && !qp.studentId && !qp.since && !qp.until) {
      setToast({
        kind: 'err',
        msg: 'Export requires at least one of: term, studentId, since, or until (keeps the CSV finite).',
      });
      return;
    }
    try {
      setExporting(true);
      const r = await exportAuditCsv(qp);
      setToast({
        kind: 'ok',
        msg: `Export ready — ${r.rowCount.toLocaleString()} row(s). Opening download…`,
      });
      // Open in a new tab. Presigned URL, so the browser handles auth.
      window.open(r.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  function toggleExpanded(logId: string) {
    setExpanded((s) => ({ ...s, [logId]: !s[logId] }));
  }

  // ---- Derived ----

  const termOptions = useMemo(() => terms?.terms || [], [terms]);

  // ---- Render ----

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-secondary-700 dark:text-white">
          Audit log
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Every grading decision, data purge, schedule change, and admin action is logged here.
          TAs have read access; export to CSV is admin-only.
        </p>
      </div>

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

      {/* ===== Section 1: Filters ===== */}
      <section className="card p-5 mb-6">
        {/* Mode toggle — global search vs per-student shortcut */}
        <div className="mb-4 flex items-center gap-2">
          <ModeButton
            active={draft.mode === 'global'}
            onClick={() => setDraft((d) => ({ ...d, mode: 'global', studentSearch: '' }))}
          >
            All entries
          </ModeButton>
          <ModeButton
            active={draft.mode === 'per-student'}
            onClick={() => setDraft((d) => ({ ...d, mode: 'per-student' }))}
          >
            Per-student shortcut
          </ModeButton>
        </div>

        {draft.mode === 'per-student' && (
          <div className="mb-4 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
            <label className="block text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide mb-1">
              Student name (studentId / PK — e.g. mneto6)
            </label>
            <input
              type="text"
              value={draft.studentSearch}
              onChange={(e) => setDraft((d) => ({ ...d, studentSearch: e.target.value }))}
              placeholder="mneto6"
              className="w-full px-3 py-2 rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
            />
            <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
              Hits the /admin/audit/&#123;studentName&#125; convenience endpoint. Other filters below still apply.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput
            label="Actor (email)"
            value={draft.actor}
            onChange={(v) => setDraft((d) => ({ ...d, actor: v }))}
            placeholder="name@gatech.edu"
          />

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Action
            </label>
            <select
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All actions{actionsLoading ? ' (loading…)' : ''}</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <FilterInput
            label="Student ID"
            value={draft.studentId}
            onChange={(v) => setDraft((d) => ({ ...d, studentId: v }))}
            placeholder="mneto6"
            mono
          />

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Source
            </label>
            <select
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All sources</option>
              {KNOWN_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Term
            </label>
            <select
              value={draft.term}
              onChange={(e) => setDraft((d) => ({ ...d, term: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">All terms</option>
              {termOptions.map((t) => (
                <option key={t.termId} value={t.termId}>
                  {t.displayName} ({t.termId}){t.isActive ? ' — active' : ''}
                </option>
              ))}
              <option value="legacy">Legacy (pre-Wave-4 data)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Since
              </label>
              <input
                type="datetime-local"
                value={draft.since}
                onChange={(e) => setDraft((d) => ({ ...d, since: e.target.value }))}
                className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Until
              </label>
              <input
                type="datetime-local"
                value={draft.until}
                onChange={(e) => setDraft((d) => ({ ...d, until: e.target.value }))}
                className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Loading…' : 'Apply filters'}
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!userIsAdmin && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Export is admin-only
              </span>
            )}
            <button
              onClick={handleExport}
              disabled={!userIsAdmin || exporting}
              title={
                !userIsAdmin
                  ? 'Admin only'
                  : 'Generates a CSV via backend and opens the presigned download URL in a new tab'
              }
              className="px-4 py-2 rounded-lg bg-gt-gold text-secondary-700 font-semibold hover:bg-gt-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting ? 'Building CSV…' : 'Export CSV'}
            </button>
          </div>
        </div>
      </section>

      {/* ===== Section 2: Results ===== */}
      <section className="card overflow-hidden mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {loading
              ? 'Loading…'
              : entries.length === 0
              ? 'No results'
              : `Showing ${entries.length.toLocaleString()} ${entries.length === 1 ? 'entry' : 'entries'}${
                  scanMode ? ` · scanMode: ${scanMode}` : ''
                }${nextToken ? ' · more available' : ''}`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Pulsing placeholder rows.
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-gray-200 dark:border-gray-800">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No audit entries match these filters.
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isOpen = !!expanded[e.logId];
                  const pillColor = colorForAction(e.action);
                  return (
                    <React.Fragment key={e.logId}>
                      <tr className="border-t border-gray-200 dark:border-gray-800 align-top">
                        <td
                          className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300"
                          title={new Date(e.timestamp).toLocaleString()}
                        >
                          <div>{relativeTime(e.timestamp)}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(e.timestamp).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {e.performedByName ? (
                            <>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {e.performedByName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 break-all">
                                {e.performedBy}
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-700 dark:text-gray-300 break-all">
                              {e.performedBy || '—'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PILL_CLASSES[pillColor]}`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                          <div>
                            <span className="text-gray-400 dark:text-gray-500">student:</span>{' '}
                            {e.studentId}
                          </div>
                          {e.labId && (
                            <div>
                              <span className="text-gray-400 dark:text-gray-500">lab:</span>{' '}
                              {e.labId}
                            </div>
                          )}
                          {e.partId && (
                            <div>
                              <span className="text-gray-400 dark:text-gray-500">part:</span>{' '}
                              {e.partId}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {e.source || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 font-mono">
                          {e.termId || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {e.details && Object.keys(e.details).length > 0 ? (
                            <button
                              onClick={() => toggleExpanded(e.logId)}
                              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              {isOpen ? 'Hide' : 'Show'} ({Object.keys(e.details).length})
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                      {isOpen && e.details && (
                        <tr className="border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                              Details · logId <code className="font-mono">{e.logId}</code>
                            </div>
                            <pre className="text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-3 overflow-x-auto text-gray-800 dark:text-gray-200">
                              {JSON.stringify(e.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {!loading && entries.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-center">
            {nextToken ? (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-sm"
              >
                {loadingMore ? 'Loading more…' : 'Load more'}
              </button>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                End of results
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

// ---------- Local sub-components ----------

const FilterInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}> = ({ label, value, onChange, placeholder, mono }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${
        mono ? 'font-mono' : ''
      }`}
    />
  </div>
);

const ModeButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-secondary-700 text-white dark:bg-gt-gold dark:text-secondary-700'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

export default AuditLogViewer;
