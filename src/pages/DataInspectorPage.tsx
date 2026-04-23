// Data inspector (Wave 8). Three stacked sections:
//
//   1. System health      — ta+ readable. Stat cards + per-table counts +
//                           S3 byte totals + Cognito count + last audit.
//                           Auto-refreshes every 30s once mounted.
//   2. Inconsistency scans — staff+ readable. Renders each check as a card,
//                           with a "Reconcile" flow (dry-run then commit) for
//                           checks whose canReconcile flag is true.
//   3. Raw table viewer    — admin-only. A peek into any of the 13
//                           whitelisted DynamoDB tables with pagination and
//                           an optional filter. Reads are audit-logged.
//
// Role gating is layered: the route (App.tsx) will require ta+, then the
// raw-table section hides itself via isAdmin(user). Backend re-checks roles
// on every endpoint, so client-side hiding is only for UX polish.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, isStaffLevel } from '../utils/roles';
import {
  HealthSnapshot,
  InconsistenciesResponse,
  InconsistencyCheck,
  ReconcileResult,
  TableRowsResponse,
  WHITELISTED_TABLES,
  fetchHealth,
  fetchInconsistencies,
  fetchTableRows,
  reconcile,
} from '../utils/adminData';

type Toast = { kind: 'ok' | 'err'; msg: string };

const HEALTH_REFRESH_MS = 30_000;

// ==============================================================
// Page
// ==============================================================

const DataInspectorPage: React.FC = () => {
  const { authState } = useAuth();
  const userIsAdmin = isAdmin(authState.user);
  const userIsStaff = isStaffLevel(authState.user);

  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-secondary-700 dark:text-white">
          Data inspector
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Near-real-time counts across DynamoDB, S3, and Cognito; scans for
          common data-integrity issues with optional reconciliation; and a raw
          table browser for the 13 whitelisted tables.
        </p>
      </div>

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

      <HealthSection onToast={setToast} />
      {userIsStaff && (
        <InconsistencySection onToast={setToast} canReconcile={userIsAdmin} />
      )}
      {userIsAdmin && <TableViewerSection onToast={setToast} />}
    </div>
  );
};

// ==============================================================
// Section 1 — System health
// ==============================================================

const HealthSection: React.FC<{ onToast: (t: Toast) => void }> = ({
  onToast,
}) => {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const load = useCallback(async (isManual: boolean) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);
      const h = await fetchHealth();
      setHealth(h);
      setLastFetchedAt(new Date().toISOString());
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      if (isManual) onToast({ kind: 'err', msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onToast]);

  // Initial fetch + auto-refresh ticker.
  useEffect(() => {
    void load(false);
    const iv = setInterval(() => void load(false), HEALTH_REFRESH_MS);
    return () => clearInterval(iv);
  }, [load]);

  const totalRows = useMemo(() => {
    if (!health) return 0;
    return Object.values(health.tables).reduce(
      (s, t) => s + (t?.count ?? 0),
      0
    );
  }, [health]);

  const totalS3Bytes = useMemo(() => {
    if (!health) return 0;
    return (
      (health.s3?.checkoffVideos?.totalBytes || 0) +
      (health.s3?.archives?.totalBytes || 0)
    );
  }, [health]);

  return (
    <section className="card p-5 mb-6 border-l-4 border-l-gt-gold">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
            System health
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            DynamoDB ItemCount is approximate (refreshes ~every 6 hours).
            Auto-refreshes every {HEALTH_REFRESH_MS / 1000}s.
            {lastFetchedAt && (
              <>
                {' '}· last fetched {relativeTime(lastFetchedAt)}
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          className="btn-primary disabled:opacity-50 whitespace-nowrap"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && !health && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          Failed to load health snapshot: {error}
        </div>
      )}

      {loading && !health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {health && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total DB rows"
              value={totalRows.toLocaleString()}
              sublabel={`${Object.keys(health.tables).length} table(s)`}
            />
            <StatCard
              label="Total S3 size"
              value={humanBytes(totalS3Bytes)}
              sublabel={`${(
                (health.s3?.checkoffVideos?.objectCount || 0) +
                (health.s3?.archives?.objectCount || 0)
              ).toLocaleString()} object(s)`}
            />
            <StatCard
              label="Cognito users"
              value={(health.cognito?.userCount || 0).toLocaleString()}
              sublabel={`${(
                health.cognito?.confirmedCount || 0
              ).toLocaleString()} confirmed`}
            />
            <StatCard
              label="Active term"
              value={health.activeTerm || '—'}
              sublabel={
                health.lastAuditAt
                  ? `Last audit ${relativeTime(health.lastAuditAt)}`
                  : 'No audit entries yet'
              }
            />
          </div>

          {/* Per-table counts */}
          <div className="mt-5">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              DynamoDB tables
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">Table</th>
                    <th className="px-4 py-2 text-right">Rows</th>
                    <th className="px-4 py-2">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(health.tables)
                    .sort(([, a], [, b]) => (b?.count ?? 0) - (a?.count ?? 0))
                    .map(([tableName, info]) => {
                      const count = info?.count ?? 0;
                      const pct =
                        totalRows > 0
                          ? Math.round((count / totalRows) * 1000) / 10
                          : 0;
                      return (
                        <tr
                          key={tableName}
                          className="border-t border-gray-200 dark:border-gray-800"
                        >
                          <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                            {tableName}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                            {count.toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden max-w-[200px]">
                                <div
                                  className="h-full bg-gt-gold"
                                  style={{ width: `${Math.max(2, pct)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-10 text-right">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* S3 breakdown */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <S3Card
              label="Checkoff videos"
              objectCount={health.s3?.checkoffVideos?.objectCount || 0}
              totalBytes={health.s3?.checkoffVideos?.totalBytes || 0}
            />
            <S3Card
              label="Archives"
              objectCount={health.s3?.archives?.objectCount || 0}
              totalBytes={health.s3?.archives?.totalBytes || 0}
            />
          </div>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Snapshot taken{' '}
            {health.timestamp
              ? `${new Date(health.timestamp).toLocaleString()} (${relativeTime(health.timestamp)})`
              : '—'}
            {health.lastAuditAt ? (
              <>
                {' '}· Last audit action: {relativeTime(health.lastAuditAt)}
              </>
            ) : (
              <>
                {' '}· Last audit action: never
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
};

// ==============================================================
// Section 2 — Inconsistency checks
// ==============================================================

const InconsistencySection: React.FC<{
  onToast: (t: Toast) => void;
  canReconcile: boolean;
}> = ({ onToast, canReconcile }) => {
  const [res, setRes] = useState<InconsistenciesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [deep, setDeep] = useState(false);

  // Per-check local state for the reconcile flow.
  const [reconcileModalFor, setReconcileModalFor] =
    useState<InconsistencyCheck | null>(null);

  async function runChecks() {
    try {
      setLoading(true);
      const r = await fetchInconsistencies(deep);
      setRes(r);
    } catch (err) {
      onToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function handleReconciled() {
    // After a successful reconcile we re-run the checks so the UI reflects
    // the new zeroed-out count instead of the stale "before" number.
    setReconcileModalFor(null);
    void runChecks();
  }

  return (
    <section className="card p-5 mb-6 border-l-4 border-l-amber-500">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
            Inconsistency checks
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Scans for common data-integrity issues — orphaned rows, dangling
            foreign keys, duplicated IDs, stale pointers. Reconciliation is
            admin-only and always preview-first.
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
              disabled={loading}
            />
            Deep scan
          </label>
          <button
            onClick={runChecks}
            disabled={loading}
            className="btn-primary disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Running…' : res ? 'Re-run checks' : 'Run checks'}
          </button>
        </div>
      </div>

      {res && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Checked {new Date(res.checkedAt).toLocaleString()} ·{' '}
          {res.durationMs.toLocaleString()} ms · {res.checks.length} check
          {res.checks.length === 1 ? '' : 's'}
        </div>
      )}

      {!res && !loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
          Click "Run checks" to scan for inconsistencies.
        </div>
      )}

      {loading && !res && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {res && (
        <div className="space-y-3">
          {res.checks.length === 0 ? (
            <div className="p-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-700 dark:text-emerald-300">
              No checks ran. Backend returned an empty check list.
            </div>
          ) : (
            res.checks.map((c) => (
              <InconsistencyCheckCard
                key={c.id}
                check={c}
                canReconcile={canReconcile}
                onReconcileClick={() => setReconcileModalFor(c)}
              />
            ))
          )}
        </div>
      )}

      {reconcileModalFor && (
        <ReconcileModal
          check={reconcileModalFor}
          onClose={() => setReconcileModalFor(null)}
          onSuccess={handleReconciled}
          onToast={onToast}
        />
      )}
    </section>
  );
};

const InconsistencyCheckCard: React.FC<{
  check: InconsistencyCheck;
  canReconcile: boolean;
  onReconcileClick: () => void;
}> = ({ check, canReconcile, onReconcileClick }) => {
  const [showSamples, setShowSamples] = useState(false);
  const isClean = check.count === 0 && !check.error;
  const hasSamples = !!check.samples && check.samples.length > 0;

  return (
    <div
      className={`p-4 rounded-lg border ${
        check.error
          ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10'
          : isClean
          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10'
          : 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isClean ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold">
                ✓
              </span>
            ) : check.error ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                !
              </span>
            ) : (
              <span className="inline-flex items-center justify-center min-w-[1.75rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold tabular-nums">
                {check.count.toLocaleString()}
              </span>
            )}
            <div className="font-semibold text-secondary-700 dark:text-white">
              {check.label}
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
            {check.id}
          </div>
          {check.note && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {check.note}
            </div>
          )}
          {check.error && (
            <div className="mt-1 text-sm text-red-700 dark:text-red-300">
              Error: {check.error}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          {hasSamples && (
            <button
              onClick={() => setShowSamples((s) => !s)}
              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
            >
              {showSamples ? 'Hide' : 'Show'} samples ({check.samples!.length})
            </button>
          )}
          {check.canReconcile && !isClean && !check.error && (
            <button
              onClick={onReconcileClick}
              disabled={!canReconcile}
              title={canReconcile ? undefined : 'Reconcile is admin-only'}
              className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-40 whitespace-nowrap"
            >
              Reconcile
            </button>
          )}
        </div>
      </div>

      {showSamples && hasSamples && (
        <pre className="mt-3 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-3 overflow-x-auto text-gray-800 dark:text-gray-200">
          {JSON.stringify(check.samples, null, 2)}
        </pre>
      )}
    </div>
  );
};

const ReconcileModal: React.FC<{
  check: InconsistencyCheck;
  onClose: () => void;
  onSuccess: () => void;
  onToast: (t: Toast) => void;
}> = ({ check, onClose, onSuccess, onToast }) => {
  const [step, setStep] = useState<
    'idle' | 'dry-running' | 'dry-run-done' | 'committing' | 'done'
  >('idle');
  const [dryRunResult, setDryRunResult] = useState<ReconcileResult | null>(null);
  const [commitResult, setCommitResult] = useState<ReconcileResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runDryRun() {
    try {
      setErr(null);
      setStep('dry-running');
      const r = await reconcile({ checks: [check.id], dryRun: true });
      setDryRunResult(r);
      setStep('dry-run-done');
    } catch (e) {
      setErr((e as Error).message);
      setStep('idle');
    }
  }

  async function commit() {
    try {
      setErr(null);
      setStep('committing');
      const r = await reconcile({ checks: [check.id], dryRun: false });
      setCommitResult(r);
      setStep('done');
      const fixed = r.results.reduce((s, x) => s + (x.fixed || 0), 0);
      onToast({
        kind: 'ok',
        msg: `Reconciled ${fixed.toLocaleString()} row(s) for ${check.id}`,
      });
    } catch (e) {
      setErr((e as Error).message);
      setStep('dry-run-done');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'committing') onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
              Reconcile: {check.label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
              {check.id} · {check.count.toLocaleString()} row(s) flagged
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'committing'}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {err && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {err}
            </div>
          )}

          {step === 'idle' && (
            <>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Reconciliation always previews first. Run the dry-run to see
                exactly which rows would be touched, then commit if it looks
                right.
              </div>
              <button
                onClick={runDryRun}
                className="btn-primary w-full sm:w-auto"
              >
                Run dry-run
              </button>
            </>
          )}

          {step === 'dry-running' && (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Running dry-run…
            </div>
          )}

          {(step === 'dry-run-done' ||
            step === 'committing' ||
            step === 'done') &&
            dryRunResult && (
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Dry-run result
                </div>
                <ReconcileResultTable result={dryRunResult} />
              </div>
            )}

          {step === 'dry-run-done' && dryRunResult && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                Ready to commit — this will permanently write the fixes.
              </div>
              <button
                onClick={commit}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                Commit fix
              </button>
            </div>
          )}

          {step === 'committing' && (
            <div className="text-sm text-amber-700 dark:text-amber-300">
              Committing reconciliation…
            </div>
          )}

          {step === 'done' && commitResult && (
            <div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-2">
                Committed
              </div>
              <ReconcileResultTable result={commitResult} />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    onSuccess();
                  }}
                  className="btn-primary"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReconcileResultTable: React.FC<{ result: ReconcileResult }> = ({
  result,
}) => (
  <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2">Check</th>
          <th className="px-3 py-2 text-right">Found</th>
          <th className="px-3 py-2 text-right">Fixed</th>
          <th className="px-3 py-2 text-right">Failed</th>
        </tr>
      </thead>
      <tbody>
        {result.results.map((r) => (
          <tr
            key={r.id}
            className="border-t border-gray-200 dark:border-gray-800"
          >
            <td className="px-3 py-1.5 font-mono text-xs text-gray-800 dark:text-gray-200">
              {r.id}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
              {r.found.toLocaleString()}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
              {r.fixed.toLocaleString()}
            </td>
            <td
              className={`px-3 py-1.5 text-right tabular-nums ${
                r.failed.length
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {r.failed.length.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      dryRun: <code>{String(result.dryRun)}</code>
    </div>
  </div>
);

// ==============================================================
// Section 3 — Raw table viewer (admin-only)
// ==============================================================

const TableViewerSection: React.FC<{ onToast: (t: Toast) => void }> = ({
  onToast,
}) => {
  const [tableName, setTableName] = useState<string>('');
  const [filterKey, setFilterKey] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [limit] = useState(50);

  const [rows, setRows] = useState<any[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Which row (by its index) is expanded in "Show raw" mode.
  const [rawIndex, setRawIndex] = useState<number | null>(null);

  const run = useCallback(
    async (token: string | null) => {
      if (!tableName) return;
      const isMore = token !== null;
      try {
        if (isMore) setLoadingMore(true);
        else {
          setLoading(true);
          setRows([]);
          setRawIndex(null);
        }
        setError(null);
        const r: TableRowsResponse = await fetchTableRows(tableName, {
          limit,
          nextToken: token || undefined,
          filterKey: filterKey.trim() || undefined,
          filterValue: filterValue.trim() || undefined,
        });
        setRows((prev) => (isMore ? [...prev, ...r.items] : r.items));
        setNextToken(r.nextToken);
        setScannedCount(
          (prev) => (isMore ? prev + r.scannedCount : r.scannedCount)
        );
        setHasFetched(true);
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        onToast({ kind: 'err', msg });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tableName, limit, filterKey, filterValue, onToast]
  );

  // Pick a column set from the first 5 items so the table header reflects
  // "what the schema looks like here". Heterogeneous items fall back to
  // "Show raw".
  const columns = useMemo(() => {
    const sample = rows.slice(0, 5);
    const union = new Set<string>();
    for (const item of sample) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const k of Object.keys(item)) union.add(k);
      }
    }
    // Preserve the order of the first item's keys where possible, then
    // append the rest in insertion order.
    const first = sample.find(
      (x) => x && typeof x === 'object' && !Array.isArray(x)
    );
    const seen = new Set<string>();
    const cols: string[] = [];
    if (first) {
      for (const k of Object.keys(first)) {
        if (union.has(k)) {
          cols.push(k);
          seen.add(k);
        }
      }
    }
    union.forEach((k) => {
      if (!seen.has(k)) cols.push(k);
    });
    return cols;
  }, [rows]);

  return (
    <section className="card p-5 mb-6 border-l-4 border-l-red-500">
      <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
        <strong>Admin-only.</strong> Reads are audit-logged. The backend only
        exposes the 13 whitelisted tables; no arbitrary table access.
      </div>

      <div className="mb-3">
        <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
          Raw table viewer
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Paginated scan of a single whitelisted DynamoDB table. An optional
          top-level attribute filter is applied server-side.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Table
          </label>
          <select
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
            disabled={loading}
          >
            <option value="">— Select a table —</option>
            {WHITELISTED_TABLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Filter key
          </label>
          <input
            type="text"
            value={filterKey}
            onChange={(e) => setFilterKey(e.target.value)}
            placeholder="e.g. termId"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Filter value
          </label>
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="e.g. sp26"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
            disabled={loading}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <button
          onClick={() => void run(null)}
          disabled={!tableName || loading}
          className="btn-primary disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Fetching…' : 'Fetch'}
        </button>
        {hasFetched && !loading && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {rows.length.toLocaleString()} item(s) shown · {scannedCount.toLocaleString()}{' '}
            scanned{nextToken ? ' · more available' : ''}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {hasFetched && !loading && rows.length === 0 && !error && (
        <div className="mt-4 p-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
          No items. Try removing the filter or check the filter key spelling.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 sticky top-0">
                <tr>
                  <th className="px-3 py-2 w-12">#</th>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="px-3 py-2 w-20">Raw</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, idx) => {
                  const isObj =
                    item && typeof item === 'object' && !Array.isArray(item);
                  const isExpanded = rawIndex === idx;
                  return (
                    <React.Fragment key={idx}>
                      <tr className="border-t border-gray-200 dark:border-gray-800 align-top">
                        <td className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                          {idx + 1}
                        </td>
                        {isObj ? (
                          columns.map((c) => (
                            <td
                              key={c}
                              className="px-3 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200 max-w-xs truncate"
                              title={formatCell(item[c])}
                            >
                              {formatCell(item[c])}
                            </td>
                          ))
                        ) : (
                          <td
                            colSpan={Math.max(1, columns.length)}
                            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 italic"
                          >
                            (non-object item)
                          </td>
                        )}
                        <td className="px-3 py-1.5">
                          <button
                            onClick={() =>
                              setRawIndex(isExpanded ? null : idx)
                            }
                            className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30">
                          <td
                            colSpan={columns.length + 2}
                            className="px-3 py-3"
                          >
                            <pre className="text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-3 overflow-x-auto text-gray-800 dark:text-gray-200 max-h-64">
                              {JSON.stringify(item, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-center">
            {nextToken ? (
              <button
                onClick={() => void run(nextToken)}
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
        </div>
      )}
    </section>
  );
};

// ==============================================================
// Sub-components & pure helpers
// ==============================================================

const StatCard: React.FC<{
  label: string;
  value: string;
  sublabel?: string;
}> = ({ label, value, sublabel }) => (
  <div className="card p-4 border border-gray-200 dark:border-gray-800">
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </div>
    <div className="mt-1 text-2xl font-display font-bold text-secondary-700 dark:text-white">
      {value}
    </div>
    {sublabel && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {sublabel}
      </div>
    )}
  </div>
);

const S3Card: React.FC<{
  label: string;
  objectCount: number;
  totalBytes: number;
}> = ({ label, objectCount, totalBytes }) => (
  <div className="card p-4 border-l-4 border-l-sky-500">
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </div>
    <div className="mt-1 text-2xl font-display font-bold text-secondary-700 dark:text-white">
      {humanBytes(totalBytes)}
    </div>
    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
      {objectCount.toLocaleString()} object{objectCount === 1 ? '' : 's'}
    </div>
  </div>
);

function formatCell(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function relativeTime(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  const diffSec = Math.round((Date.now() - d) / 1000);
  if (diffSec < 0) {
    const fwd = Math.abs(diffSec);
    if (fwd < 60) return `in ${fwd}s`;
    if (fwd < 3600) return `in ${Math.round(fwd / 60)}m`;
    if (fwd < 86400) return `in ${Math.round(fwd / 3600)}h`;
    return `in ${Math.round(fwd / 86400)}d`;
  }
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
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

export default DataInspectorPage;
