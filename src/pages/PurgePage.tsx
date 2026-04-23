// Term data purge (Wave 5). Admin-only page for the "clean out everything
// from last semester" workflow: snapshot to Glacier-ish storage, dry-run
// the delete, then commit the purge. Also handles per-student progress
// resets and orphaned-media cleanup as secondary tools.
//
// This page is intentionally friction-heavy — every destructive action
// requires typing the target string to confirm, and the purge path forces
// a fresh snapshot + a dry-run preview before the real DELETE can fire.

import React, { useEffect, useMemo, useState } from 'react';
import { Term, TermListResponse } from '../types';
import { describeTerm, fetchAllTerms } from '../utils/terms';
import {
  OrphanedMedia,
  PurgeResult,
  SnapshotResult,
  StudentResetResult,
  TermUsage,
  createSnapshot,
  deleteOrphanedMedia,
  fetchTermUsage,
  listOrphanedMedia,
  purgeTermData,
  resetStudentProgress,
} from '../utils/purge';

type Toast = { kind: 'ok' | 'err'; msg: string };

const LEGACY_TERM_ID = 'legacy';
const SNAPSHOT_FRESH_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const PurgePage: React.FC = () => {
  // Shared
  const [toast, setToast] = useState<Toast | null>(null);

  // Terms list (for the dropdown in section 1)
  const [terms, setTerms] = useState<TermListResponse | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  // Section 1 — Term purge
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [usage, setUsage] = useState<TermUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<SnapshotResult | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeStep, setPurgeStep] = useState<'idle' | 'dry-running' | 'dry-run-done' | 'committing' | 'done'>('idle');
  const [dryRunResult, setDryRunResult] = useState<PurgeResult | null>(null);
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);

  // Section 2 — Student reset
  const [studentName, setStudentName] = useState('');
  const [studentConfirmText, setStudentConfirmText] = useState('');
  const [studentResetting, setStudentResetting] = useState(false);
  const [studentResult, setStudentResult] = useState<StudentResetResult | null>(null);

  // Section 3 — Orphans
  const [orphanScan, setOrphanScan] = useState<OrphanedMedia | null>(null);
  const [orphanScanning, setOrphanScanning] = useState(false);
  const [orphanDeleting, setOrphanDeleting] = useState(false);
  const [orphanDeleted, setOrphanDeleted] = useState<OrphanedMedia | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAllTerms();
        if (!cancelled) setTerms(res);
      } catch (err) {
        if (!cancelled) setTermsError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // When the selected term changes, reset all the dependent state so a stale
  // usage/dry-run from a previous term can't leak into a new purge flow.
  useEffect(() => {
    setUsage(null);
    setUsageError(null);
    setLastSnapshot(null);
    setPurgeConfirmText('');
    setPurgeStep('idle');
    setDryRunResult(null);
    setPurgeResult(null);
  }, [selectedTermId]);

  // ---------- Section 1 handlers ----------

  async function handlePreviewUsage() {
    if (!selectedTermId) return;
    try {
      setUsageLoading(true);
      setUsageError(null);
      const u = await fetchTermUsage(selectedTermId);
      setUsage(u);
    } catch (err) {
      setUsageError((err as Error).message);
    } finally {
      setUsageLoading(false);
    }
  }

  async function handleCreateSnapshot() {
    if (!selectedTermId) return;
    try {
      setSnapshotting(true);
      const s = await createSnapshot(selectedTermId);
      setLastSnapshot(s);
      setToast({ kind: 'ok', msg: `Snapshot created: ${s.archiveUri}` });
      // Refresh usage to pick up lastSnapshot / freshness badge.
      await handlePreviewUsage();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleDryRun() {
    if (!selectedTermId) return;
    try {
      setPurgeStep('dry-running');
      const r = await purgeTermData(selectedTermId, true);
      setDryRunResult(r);
      setPurgeStep('dry-run-done');
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
      setPurgeStep('idle');
    }
  }

  async function handleCommitPurge() {
    if (!selectedTermId) return;
    try {
      setPurgeStep('committing');
      const r = await purgeTermData(selectedTermId, false);
      setPurgeResult(r);
      setPurgeStep('done');
      setToast({ kind: 'ok', msg: `Purge complete for ${selectedTermId}` });
      // Usage is now stale; blow it away so the UI doesn't pretend there are
      // still rows to delete.
      setUsage(null);
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
      setPurgeStep('dry-run-done'); // let them try again
    }
  }

  function resetPurgeFlow() {
    setPurgeConfirmText('');
    setPurgeStep('idle');
    setDryRunResult(null);
    setPurgeResult(null);
  }

  // ---------- Section 2 handlers ----------

  async function handleStudentReset() {
    const name = studentName.trim();
    if (!name) return;
    try {
      setStudentResetting(true);
      const r = await resetStudentProgress(name);
      setStudentResult(r);
      setToast({ kind: 'ok', msg: `Reset progress for ${name} in ${r.termId}` });
      setStudentConfirmText('');
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setStudentResetting(false);
    }
  }

  // ---------- Section 3 handlers ----------

  async function handleOrphanScan() {
    try {
      setOrphanScanning(true);
      setOrphanDeleted(null);
      const r = await listOrphanedMedia();
      setOrphanScan(r);
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setOrphanScanning(false);
    }
  }

  async function handleOrphanDelete() {
    if (!orphanScan || orphanScan.orphanCount === 0) return;
    if (
      !window.confirm(
        `Permanently delete ${orphanScan.orphanCount} orphaned S3 object(s)? This cannot be undone.`
      )
    )
      return;
    try {
      setOrphanDeleting(true);
      const r = await deleteOrphanedMedia();
      setOrphanDeleted(r);
      setToast({
        kind: 'ok',
        msg: `Deleted ${r.deletedCount ?? r.orphanCount} orphaned object(s)`,
      });
      // Clear the scan so the UI obviously reflects post-delete state.
      setOrphanScan(null);
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setOrphanDeleting(false);
    }
  }

  // ---------- Derived ----------

  const termOptions = useMemo<Array<Pick<Term, 'termId' | 'displayName' | 'isActive'>>>(() => {
    const real = (terms?.terms || []).map((t) => ({
      termId: t.termId,
      displayName: t.displayName,
      isActive: !!t.isActive,
    }));
    return [
      ...real,
      { termId: LEGACY_TERM_ID, displayName: 'Legacy (pre-Wave-4 data)', isActive: false },
    ];
  }, [terms]);

  // Freshness is judged from what the server reports in `usage.lastSnapshot`
  // — that's the authoritative record. A snapshot taken during this session
  // lives in `lastSnapshot` until the next `handlePreviewUsage()` refresh
  // picks it up, but we don't use it for the freshness check: we want the
  // server to have committed the manifest before we treat it as real.
  const snapshotIsFresh = useMemo(() => {
    const ts = usage?.lastSnapshot?.createdAt;
    if (!ts) return false;
    const d = Date.parse(ts);
    if (Number.isNaN(d)) return false;
    return Date.now() - d <= SNAPSHOT_FRESH_WINDOW_MS;
  }, [usage]);

  const canPurge = !!usage && !usage.isActive && snapshotIsFresh;
  const purgeConfirmMatches = purgeConfirmText.trim() === selectedTermId && selectedTermId.length > 0;
  const studentConfirmMatches =
    studentConfirmText.trim().length > 0 &&
    studentConfirmText.trim() === studentName.trim();

  // ---------- Render ----------

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-secondary-700 dark:text-white">
          Data purge
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Destructive lifecycle operations: archive + purge an entire term, reset one student's
          progress for the active term, or prune orphaned video objects in S3. All actions here
          are irreversible — read carefully.
        </p>
      </div>

      {termsError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          Failed to load terms list: {termsError}
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

      {/* ===== Section 1: Term purge ===== */}
      <section className="card p-5 mb-6 border-l-4 border-l-red-500">
        <div className="mb-3">
          <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
            Term data purge
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Wipes every per-term row (progress, grades, submissions, status, partner pairings,
            audit entries) plus associated video objects. Requires a fresh snapshot (under 1 hour
            old) as an archive fallback before the delete is allowed.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">— Select a term —</option>
              {termOptions.map((t) => (
                <option key={t.termId} value={t.termId}>
                  {t.displayName} ({t.termId}){t.isActive ? ' — active' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              className="btn-primary w-full"
              onClick={handlePreviewUsage}
              disabled={!selectedTermId || usageLoading}
            >
              {usageLoading ? 'Loading…' : 'Preview usage'}
            </button>
          </div>
        </div>

        {usageError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {usageError}
          </div>
        )}

        {usage && (
          <div className="mt-5 space-y-4">
            {usage.isActive && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                <strong>This term is currently active</strong> — activate a different term in
                Terms management before you can purge this one.
              </div>
            )}

            {/* Row-count table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">DynamoDB table</th>
                    <th className="px-4 py-2 text-right">Row count</th>
                    <th className="px-4 py-2">Queried via</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usage.tables).map(([tableName, info]) => (
                    <tr
                      key={tableName}
                      className="border-t border-gray-200 dark:border-gray-800"
                    >
                      <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">
                        {tableName}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {info.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            info.queried === 'gsi'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {info.queried}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">Total rows</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                      {usage.totalRows.toLocaleString()}
                    </td>
                    <td className="px-4 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* S3 summary + snapshot freshness */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="card p-4 border-l-4 border-l-sky-500">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  S3 video objects
                </div>
                <div className="mt-1 text-2xl font-display font-bold text-secondary-700 dark:text-white">
                  {usage.s3.videos.objectCount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {humanBytes(usage.s3.videos.totalBytes)} total
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Basis: {usage.s3.videos.estimatedBasedOn}
                </div>
              </div>
              <div
                className={`card p-4 border-l-4 ${
                  usage.lastSnapshot
                    ? snapshotIsFresh
                      ? 'border-l-emerald-500'
                      : 'border-l-amber-500'
                    : 'border-l-gray-400 dark:border-l-gray-700'
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Latest snapshot
                </div>
                {usage.lastSnapshot ? (
                  <>
                    <div className="mt-1 text-base font-mono text-secondary-700 dark:text-white break-all">
                      {usage.lastSnapshot.snapshotId}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(usage.lastSnapshot.createdAt).toLocaleString()} ·{' '}
                      {relativeTime(usage.lastSnapshot.createdAt)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                      <code>{usage.lastSnapshot.archiveUri}</code>
                    </div>
                    <div className="mt-2">
                      {snapshotIsFresh ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Fresh (&lt; 1 hour) — purge unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Stale (&gt; 1 hour) — create a new snapshot before purge
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    No snapshot on file. Take one before purging.
                  </div>
                )}
              </div>
            </div>

            {/* Action row: Snapshot / Purge */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                className="btn-primary"
                onClick={handleCreateSnapshot}
                disabled={snapshotting}
              >
                {snapshotting ? 'Archiving…' : 'Create snapshot'}
              </button>

              {purgeStep === 'idle' && (
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="text"
                    value={purgeConfirmText}
                    onChange={(e) => setPurgeConfirmText(e.target.value)}
                    placeholder={`Type "${selectedTermId}" to confirm`}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                    disabled={!canPurge}
                  />
                  <button
                    onClick={handleDryRun}
                    disabled={!canPurge || !purgeConfirmMatches}
                    className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 whitespace-nowrap"
                    title={
                      !usage
                        ? 'Preview usage first'
                        : usage.isActive
                        ? 'Term is active — cannot purge'
                        : !snapshotIsFresh
                        ? 'Snapshot must be under 1 hour old'
                        : !purgeConfirmMatches
                        ? `Type "${selectedTermId}" to confirm`
                        : ''
                    }
                  >
                    I understand, run dry-run first
                  </button>
                </div>
              )}
            </div>

            {/* Dry-run result + commit button */}
            {(purgeStep === 'dry-running' ||
              purgeStep === 'dry-run-done' ||
              purgeStep === 'committing') && (
              <div className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-red-700 dark:text-red-300">
                    {purgeStep === 'dry-running'
                      ? 'Running dry-run…'
                      : 'Dry-run preview — nothing has been deleted yet'}
                  </div>
                  <button
                    onClick={resetPurgeFlow}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
                {dryRunResult && (
                  <DeletionTable
                    deleted={dryRunResult.deleted}
                    s3ObjectsDeleted={dryRunResult.s3ObjectsDeleted}
                  />
                )}
                {purgeStep === 'dry-run-done' && (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="text-sm text-red-700 dark:text-red-300 flex-1">
                      Ready to commit. This will permanently delete the rows above for{' '}
                      <code className="font-mono">{selectedTermId}</code>.
                    </div>
                    <button
                      onClick={handleCommitPurge}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                    >
                      Commit purge
                    </button>
                  </div>
                )}
                {purgeStep === 'committing' && (
                  <div className="mt-3 text-sm text-red-700 dark:text-red-300">
                    Purging… this can take a minute or two for large terms.
                  </div>
                )}
              </div>
            )}

            {/* Final result */}
            {purgeStep === 'done' && purgeResult && (
              <div className="p-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <div className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                  Purge complete for {selectedTermId}
                </div>
                <DeletionTable
                  deleted={purgeResult.deleted}
                  s3ObjectsDeleted={purgeResult.s3ObjectsDeleted}
                />
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Started {new Date(purgeResult.startedAt).toLocaleString()} · finished{' '}
                  {new Date(purgeResult.finishedAt).toLocaleString()} · elapsed{' '}
                  {(purgeResult.durationMs / 1000).toFixed(1)}s
                  {purgeResult.snapshotId && (
                    <>
                      {' '}· snapshot <code>{purgeResult.snapshotId}</code>
                    </>
                  )}
                </div>
                <div className="mt-3">
                  <button
                    onClick={resetPurgeFlow}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Show the most-recent in-memory snapshot result if any */}
            {lastSnapshot && !usage.lastSnapshot && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Latest snapshot (this session): <code>{lastSnapshot.snapshotId}</code> →{' '}
                <code>{lastSnapshot.archiveUri}</code>
              </div>
            )}
          </div>
        )}

        {selectedTermId && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Selected term display name:{' '}
            <strong>
              {selectedTermId === LEGACY_TERM_ID
                ? 'Legacy (pre-Wave-4 data)'
                : describeTerm(selectedTermId)}
            </strong>
          </div>
        )}
      </section>

      {/* ===== Section 2: Student reset ===== */}
      <section className="card p-5 mb-6 border-l-4 border-l-red-500">
        <div className="mb-3">
          <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
            Per-student progress reset
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Wipes this student's progress, grades, lab status, and video submissions for the
            currently active term only. Historical data from prior terms is untouched.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Student name (PK — e.g. mneto6)
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => {
                setStudentName(e.target.value);
                setStudentConfirmText('');
                setStudentResult(null);
              }}
              placeholder="mneto6"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
              disabled={studentResetting}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Confirm — re-type the name
            </label>
            <input
              type="text"
              value={studentConfirmText}
              onChange={(e) => setStudentConfirmText(e.target.value)}
              placeholder={studentName || 'Enter a name above first'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
              disabled={!studentName.trim() || studentResetting}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleStudentReset}
            disabled={!studentConfirmMatches || studentResetting}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
          >
            {studentResetting ? 'Resetting…' : 'Reset progress'}
          </button>
        </div>

        {studentResult && (
          <div className="mt-4 p-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
              Reset complete — <code>{studentResult.studentId}</code> in{' '}
              <code>{studentResult.termId}</code>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <ResetRow label="Progress rows" value={studentResult.deleted.progress} />
                  <ResetRow label="Grade rows" value={studentResult.deleted.grades} />
                  <ResetRow label="Status rows" value={studentResult.deleted.status} />
                  <ResetRow label="Submissions" value={studentResult.deleted.submissions} />
                  <ResetRow label="S3 video objects" value={studentResult.s3ObjectsDeleted} />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ===== Section 3: Orphaned media ===== */}
      <section className="card p-5 mb-6 border-l-4 border-l-red-500">
        <div className="mb-3">
          <div className="font-display text-xl font-bold text-secondary-700 dark:text-white">
            Orphaned media cleanup
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Scans the submissions bucket for video objects whose owning submission row no longer
            exists (e.g. left over from an aborted upload, a manual DB cleanup, or a crashed
            re-submit). Scan first, review samples, then delete.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleOrphanScan}
            disabled={orphanScanning}
            className="btn-primary"
          >
            {orphanScanning ? 'Scanning…' : 'Scan for orphaned videos'}
          </button>
          <button
            onClick={handleOrphanDelete}
            disabled={!orphanScan || orphanScan.orphanCount === 0 || orphanDeleting}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
          >
            {orphanDeleting ? 'Deleting…' : 'Delete orphaned videos'}
          </button>
        </div>

        {orphanScan && (
          <div className="mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
              <Stat label="Objects scanned" value={orphanScan.scanned.toLocaleString()} />
              <Stat label="Orphans found" value={orphanScan.orphanCount.toLocaleString()} />
              <Stat label="Samples returned" value={orphanScan.samples.length.toLocaleString()} />
            </div>
            {orphanScan.samples.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Sample keys ({orphanScan.samples.length} of {orphanScan.orphanCount})
                </div>
                <div className="max-h-64 overflow-y-auto rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-2 font-mono text-xs">
                  {orphanScan.samples.slice(0, 50).map((k) => (
                    <div
                      key={k}
                      className="px-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0 break-all text-gray-700 dark:text-gray-300"
                    >
                      {k}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {orphanDeleted && (
          <div className="mt-4 p-4 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="font-semibold text-emerald-700 dark:text-emerald-300">
              Deleted {orphanDeleted.deletedCount ?? orphanDeleted.orphanCount} orphaned
              object(s)
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Scanned {orphanDeleted.scanned.toLocaleString()} object(s) in total.
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

// ---------- Local sub-components ----------

const DeletionTable: React.FC<{
  deleted: Record<string, number>;
  s3ObjectsDeleted: number;
}> = ({ deleted, s3ObjectsDeleted }) => {
  const rows = Object.entries(deleted);
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          <tr>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2 text-right">Rows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, n]) => (
            <tr key={k} className="border-t border-gray-200 dark:border-gray-800">
              <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">{k}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
                {n.toLocaleString()}
              </td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 dark:border-gray-800">
            <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">
              s3:videos (objects)
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
              {s3ObjectsDeleted.toLocaleString()}
            </td>
          </tr>
          <tr className="border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <td className="px-3 py-1.5 font-semibold text-gray-900 dark:text-white">
              Total DB rows
            </td>
            <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
              {total.toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ResetRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <tr className="border-t border-emerald-200 dark:border-emerald-800/40 first:border-0">
    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{label}</td>
    <td className="px-2 py-1 text-right tabular-nums text-gray-900 dark:text-white">
      {value.toLocaleString()}
    </td>
  </tr>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 text-2xl font-display font-bold text-secondary-700 dark:text-white">
      {value}
    </div>
  </div>
);

// ---------- Pure helpers ----------

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
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default PurgePage;
