import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LabCard from '../components/labs/LabCard';
import { Lab, LabStatus } from '../types';
import { API_ENDPOINT } from '../aws-config';
import ConfirmationPopup from '../components/ConfirmationPopup';
import { isStaffLevel, isAdmin } from '../utils/roles';
import {
  CreateLabInput,
  DeleteLabResult,
  bulkLockLabs,
  bulkUnlockLabs,
  cancelScheduledUnlock,
  cloneLab,
  createLab,
  deleteLab,
  reorderLabs,
  scheduleUnlockLab,
} from '../utils/labs';

type Toast = { kind: 'ok' | 'err'; msg: string };

const LabsPage: React.FC = () => {
  const { authState, viewAsStudent } = useAuth();
  const [labs, setLabs] = useState<(Lab & Partial<LabStatus>)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'lock' | 'unlock'>('unlock');
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isStaff = isStaffLevel(authState.user);
  const isAdminUser = isAdmin(authState.user);
  const showAdminControls = isAdminUser && !viewAsStudent;

  // Admin toolbar state
  const [toast, setToast] = useState<Toast | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createOrder, setCreateOrder] = useState('');

  const [bulkBusy, setBulkBusy] = useState<null | 'lock' | 'unlock'>(null);
  const [bulkConfirm, setBulkConfirm] = useState<null | 'lock' | 'unlock'>(null);

  // Reorder state
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Per-lab admin menu state
  const [openMenuLabId, setOpenMenuLabId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Clone modal state
  const [cloneModalFor, setCloneModalFor] = useState<string | null>(null);
  const [cloneTitle, setCloneTitle] = useState('');
  const [cloneNewId, setCloneNewId] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);

  // Schedule unlock modal state
  const [scheduleModalFor, setScheduleModalFor] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');
  const [scheduleBusy, setScheduleBusy] = useState(false);

  // Delete modal state
  const [deleteModalFor, setDeleteModalFor] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteStep, setDeleteStep] = useState<'idle' | 'dry-running' | 'dry-run-done' | 'committing' | 'done'>(
    'idle'
  );
  const [deleteDryRun, setDeleteDryRun] = useState<DeleteLabResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<DeleteLabResult | null>(null);

  const processedLabs = useMemo(() => {
    return labs.map((lab: Lab & Partial<LabStatus>) => {
      const isLocked = lab.locked !== undefined ? lab.locked : (lab.labId !== 'lab0');
      return {
        ...lab,
        locked: isLocked,
        status: isLocked ? 'locked' : 'unlocked',
        completed: lab.completed || false
      };
    });
  }, [labs]);

  // Stats
  const stats = useMemo(() => {
    const total = processedLabs.length;
    const unlocked = processedLabs.filter(l => l.status === 'unlocked').length;
    const completed = processedLabs.filter(l => l.completed).length;
    return { total, unlocked, completed };
  }, [processedLabs]);

  useEffect(() => {
    fetchLabs();

    const labAccessError = sessionStorage.getItem('labAccessError');
    if (labAccessError) {
      setError(labAccessError);
      sessionStorage.removeItem('labAccessError');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, viewAsStudent]);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Close the per-row admin menu on outside click
  useEffect(() => {
    if (!openMenuLabId) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuLabId(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenuLabId]);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      setError(null);

      const idToken = localStorage.getItem('idToken');

      if (!idToken) {
        throw new Error('No authentication token found');
      }
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}labs`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch labs');
      }

      const data = await response.json();

      const labsWithStatus = data.map((lab: Lab & Partial<LabStatus>) => {
        if (lab.locked === undefined) {
          lab.locked = lab.labId === 'lab0' ? false : true;
        }
        return {
          ...lab,
          status: lab.locked ? 'locked' : 'unlocked'
        };
      });

      setLabs(labsWithStatus);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching labs:', err);
    } finally {
      setLoading(false);
    }
  };

  const showUnlockConfirmation = (labId: string) => {
    setSelectedLabId(labId);
    setConfirmationAction('unlock');
    setShowConfirmation(true);
  };

  const showLockConfirmation = (labId: string) => {
    setSelectedLabId(labId);
    setConfirmationAction('lock');
    setShowConfirmation(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedLabId) return;

    if (confirmationAction === 'unlock') {
      await handleUnlockLabForAll(selectedLabId);
    } else {
      await handleLockLabForAll(selectedLabId);
    }

    setShowConfirmation(false);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setSelectedLabId(null);
  };

  const handleUnlockLabForAll = async (labId: string) => {
    try {
      setLoading(true);
      setError(null);

      const idToken = localStorage.getItem('idToken');

      if (!idToken) {
        throw new Error('No authentication token found');
      }

      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const url = `${baseUrl}labs/${labId}/unlock`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlock lab');
      }

      setLabs(prevLabs =>
        prevLabs.map(lab =>
          lab.labId === labId
            ? { ...lab, locked: false, status: 'unlocked' }
            : lab
        )
      );

      setSuccessMessage('Lab unlocked successfully!');
      setShowSuccess(true);

      await fetchLabs();
    } catch (err) {
      setError((err as Error).message);
      console.error('Error unlocking lab:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLockLabForAll = async (labId: string) => {
    try {
      setLoading(true);
      setError(null);

      const idToken = localStorage.getItem('idToken');

      if (!idToken) {
        throw new Error('No authentication token found');
      }

      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const url = `${baseUrl}labs/${labId}/lock`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to lock lab');
      }

      setLabs(prevLabs =>
        prevLabs.map(lab =>
          lab.labId === labId
            ? { ...lab, locked: true, status: 'locked' }
            : lab
        )
      );

      setSuccessMessage('Lab locked successfully!');
      setShowSuccess(true);

      await fetchLabs();
    } catch (err) {
      setError((err as Error).message);
      console.error('Error locking lab:', err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Admin toolbar handlers ----------

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = createTitle.trim();
    if (!title) {
      setToast({ kind: 'err', msg: 'Title is required' });
      return;
    }
    try {
      setCreateBusy(true);
      const input: CreateLabInput = { title };
      if (createDescription.trim()) input.description = createDescription.trim();
      if (createOrder.trim() && !Number.isNaN(Number(createOrder))) {
        input.order = Number(createOrder);
      }
      const lab = await createLab(input);
      setToast({ kind: 'ok', msg: `Created ${lab.labId}` });
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateOrder('');
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleBulkConfirm() {
    if (!bulkConfirm) return;
    try {
      setBulkBusy(bulkConfirm);
      if (bulkConfirm === 'lock') {
        await bulkLockLabs('all');
        setToast({ kind: 'ok', msg: 'All labs locked' });
      } else {
        await bulkUnlockLabs('all');
        setToast({ kind: 'ok', msg: 'All labs unlocked' });
      }
      setBulkConfirm(null);
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setBulkBusy(null);
    }
  }

  function startReorderMode() {
    // Seed the reorder list with the current student-facing ordering.
    const sortedIds = [...processedLabs]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((l) => l.labId);
    setReorderList(sortedIds);
    setReorderMode(true);
  }

  function exitReorderMode() {
    setReorderMode(false);
    setReorderList([]);
  }

  function moveReorder(idx: number, dir: -1 | 1) {
    const next = [...reorderList];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setReorderList(next);
  }

  async function saveReorder() {
    const orders = reorderList.map((labId, i) => ({ labId, order: i + 1 }));
    try {
      setSavingOrder(true);
      const res = await reorderLabs(orders);
      setToast({
        kind: res.failed?.length ? 'err' : 'ok',
        msg: `Reorder: ${res.updated} updated${
          res.failed?.length ? `, ${res.failed.length} failed` : ''
        }`,
      });
      exitReorderMode();
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setSavingOrder(false);
    }
  }

  // ---------- Per-lab admin action handlers ----------

  function openCloneModal(labId: string, currentTitle: string) {
    setOpenMenuLabId(null);
    setCloneModalFor(labId);
    setCloneTitle(`${currentTitle} (copy)`);
    setCloneNewId('');
  }

  async function handleCloneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cloneModalFor) return;
    try {
      setCloneBusy(true);
      const overrides: { newLabId?: string; title?: string } = {};
      if (cloneNewId.trim()) overrides.newLabId = cloneNewId.trim();
      if (cloneTitle.trim()) overrides.title = cloneTitle.trim();
      const lab = await cloneLab(cloneModalFor, overrides);
      setToast({ kind: 'ok', msg: `Cloned to ${lab.labId}` });
      setCloneModalFor(null);
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setCloneBusy(false);
    }
  }

  function openScheduleModal(labId: string, existing?: string) {
    setOpenMenuLabId(null);
    setScheduleModalFor(labId);
    // datetime-local wants "YYYY-MM-DDTHH:MM"
    if (existing) {
      const d = new Date(existing);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
          d.getHours()
        )}:${pad(d.getMinutes())}`;
        setScheduleValue(local);
        return;
      }
    }
    setScheduleValue('');
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleModalFor || !scheduleValue) return;
    try {
      setScheduleBusy(true);
      // datetime-local is naive local time; convert to ISO for the wire.
      const iso = new Date(scheduleValue).toISOString();
      await scheduleUnlockLab(scheduleModalFor, iso);
      setToast({ kind: 'ok', msg: `Scheduled unlock for ${scheduleModalFor}` });
      setScheduleModalFor(null);
      setScheduleValue('');
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setScheduleBusy(false);
    }
  }

  async function handleCancelSchedule(labId: string) {
    setOpenMenuLabId(null);
    try {
      await cancelScheduledUnlock(labId);
      setToast({ kind: 'ok', msg: `Cleared schedule for ${labId}` });
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    }
  }

  function openDeleteModal(labId: string) {
    setOpenMenuLabId(null);
    setDeleteModalFor(labId);
    setDeleteConfirmText('');
    setDeleteStep('idle');
    setDeleteDryRun(null);
    setDeleteResult(null);
  }

  function closeDeleteModal() {
    setDeleteModalFor(null);
    setDeleteConfirmText('');
    setDeleteStep('idle');
    setDeleteDryRun(null);
    setDeleteResult(null);
  }

  async function handleDeleteDryRun() {
    if (!deleteModalFor) return;
    try {
      setDeleteStep('dry-running');
      const r = await deleteLab(deleteModalFor, true);
      setDeleteDryRun(r);
      setDeleteStep('dry-run-done');
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
      setDeleteStep('idle');
    }
  }

  async function handleDeleteCommit() {
    if (!deleteModalFor) return;
    try {
      setDeleteStep('committing');
      const r = await deleteLab(deleteModalFor, false);
      setDeleteResult(r);
      setDeleteStep('done');
      setToast({ kind: 'ok', msg: `Deleted ${deleteModalFor}` });
      await fetchLabs();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
      setDeleteStep('dry-run-done');
    }
  }

  const deleteConfirmMatches =
    !!deleteModalFor && deleteConfirmText.trim() === deleteModalFor;

  if (loading && labs.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3 mb-4"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded mt-4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const labsById = new Map(processedLabs.map((l) => [l.labId, l]));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Labs</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete each lab assignment by submitting video demonstrations of your work.
        </p>
      </div>

      {/* Toast — admin only; surfaces success/error from admin ops */}
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

      {/* Admin toolbar */}
      {showAdminControls && (
        <div className="card p-4 mb-6 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-display text-lg font-bold text-secondary-700 dark:text-white">
                Lab admin controls
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Create, reorder, clone, schedule, and delete labs. Destructive actions require
                typed confirmation.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-sm"
            >
              Create new lab
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirm('lock')}
              disabled={bulkBusy !== null}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {bulkBusy === 'lock' ? 'Locking…' : 'Bulk lock all'}
            </button>
            <button
              type="button"
              onClick={() => setBulkConfirm('unlock')}
              disabled={bulkBusy !== null}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
            >
              {bulkBusy === 'unlock' ? 'Unlocking…' : 'Bulk unlock all'}
            </button>
            <button
              type="button"
              onClick={() => (reorderMode ? exitReorderMode() : startReorderMode())}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                reorderMode
                  ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                  : 'border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
              }`}
            >
              {reorderMode ? 'Exit reorder mode' : 'Reorder labs'}
            </button>
          </div>

          {reorderMode && (
            <div className="mt-4 p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-900/10">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Drag-free reorder: use the up/down arrows to move each lab. The list below is what
                students will see top-to-bottom. Click "Save order" to commit.
              </div>
              <ul className="space-y-1">
                {reorderList.map((labId, idx) => {
                  const lab = labsById.get(labId);
                  return (
                    <li
                      key={labId}
                      className="flex items-center justify-between gap-3 p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    >
                      <div className="text-sm text-gray-800 dark:text-gray-100 truncate">
                        <code className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">
                          {idx + 1}.
                        </code>
                        <span className="font-medium">{lab?.title || labId}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({labId})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveReorder(idx, -1)}
                          disabled={idx === 0 || savingOrder}
                          aria-label="Move up"
                          className="p-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveReorder(idx, 1)}
                          disabled={idx === reorderList.length - 1 || savingOrder}
                          aria-label="Move down"
                          className="p-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={exitReorderMode}
                  disabled={savingOrder}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveReorder}
                  disabled={savingOrder}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {savingOrder ? 'Saving…' : 'Save order'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8 animate-slide-up">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/50 flex items-center justify-center">
            <svg className="w-6 h-6 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Labs</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gt-gold/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-gt-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.unlocked}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Unlocked</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.completed}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3 animate-shake">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Access Restricted</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
          </div>
        </div>
      )}

      {/* Lab Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-slide-up animation-delay-100">
        {processedLabs.map((lab, index) => (
          <div
            key={lab.labId}
            className="relative"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <LabCard
              lab={lab}
              status={lab as unknown as LabStatus}
              isStaff={isStaff}
              viewAsStudent={viewAsStudent}
            />

            {/* Scheduled-unlock badge (visible to everyone — mirrors backend contract) */}
            {lab.unlockAt && (
              <div className="absolute top-3 left-20 z-10">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 shadow">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Unlock: {new Date(lab.unlockAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            {/* Staff Lock/Unlock Button (existing — unchanged) */}
            {isStaff && !viewAsStudent && (
              <div className="absolute -top-2 -right-2 z-10">
                {lab.status === 'locked' ? (
                  <button
                    onClick={() => showUnlockConfirmation(lab.labId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Unlock
                  </button>
                ) : (
                  <button
                    onClick={() => showLockConfirmation(lab.labId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Lock
                  </button>
                )}
              </div>
            )}

            {/* Admin action dropdown (three-dot menu) — admin only */}
            {showAdminControls && (
              <div className="absolute top-8 right-2 z-20">
                <div
                  className="relative"
                  ref={openMenuLabId === lab.labId ? menuRef : undefined}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenuLabId === lab.labId}
                    onClick={() =>
                      setOpenMenuLabId(openMenuLabId === lab.labId ? null : lab.labId)
                    }
                    className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow hover:bg-white dark:hover:bg-gray-800"
                    title="Admin actions"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>

                  {openMenuLabId === lab.labId && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 text-sm"
                    >
                      <Link
                        to={`/labs/${lab.labId}/edit`}
                        onClick={() => setOpenMenuLabId(null)}
                        className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        role="menuitem"
                      >
                        Edit content
                      </Link>
                      <button
                        type="button"
                        onClick={() => openCloneModal(lab.labId, lab.title)}
                        className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        role="menuitem"
                      >
                        Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => openScheduleModal(lab.labId, lab.unlockAt)}
                        className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        role="menuitem"
                      >
                        {lab.unlockAt ? 'Edit scheduled unlock' : 'Schedule unlock'}
                      </button>
                      {lab.unlockAt && (
                        <button
                          type="button"
                          onClick={() => handleCancelSchedule(lab.labId)}
                          className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                          role="menuitem"
                        >
                          Cancel scheduled unlock
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDeleteModal(lab.labId)}
                        className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-200 dark:border-gray-700"
                        role="menuitem"
                      >
                        Delete…
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {labs.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">No labs available yet.</p>
        </div>
      )}

      {/* Confirmation Popup — existing unlock/lock flow (unchanged) */}
      <ConfirmationPopup
        isOpen={showConfirmation}
        title={confirmationAction === 'unlock' ? 'Unlock Lab for All Students' : 'Lock Lab for All Students'}
        message={
          confirmationAction === 'unlock'
            ? 'This will unlock the lab for ALL students. Are you sure?'
            : 'This will lock the lab for ALL students. Are you sure?'
        }
        confirmText={confirmationAction === 'unlock' ? 'Unlock Lab' : 'Lock Lab'}
        confirmButtonColor={confirmationAction === 'unlock' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelConfirmation}
      />

      {/* Success Popup */}
      <ConfirmationPopup
        isOpen={showSuccess}
        title="Success"
        message={successMessage}
        confirmText="OK"
        confirmButtonColor="bg-emerald-500 hover:bg-emerald-600"
        onConfirm={() => setShowSuccess(false)}
        onCancel={() => setShowSuccess(false)}
        isSuccess={true}
      />

      {/* Bulk lock/unlock confirmation */}
      <ConfirmationPopup
        isOpen={bulkConfirm !== null}
        title={bulkConfirm === 'lock' ? 'Lock ALL labs' : 'Unlock ALL labs'}
        message={
          bulkConfirm === 'lock'
            ? 'This will lock every lab in the course for every student.'
            : 'This will unlock every lab in the course for every student.'
        }
        confirmText={bulkConfirm === 'lock' ? 'Lock all' : 'Unlock all'}
        confirmButtonColor={bulkConfirm === 'lock' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkConfirm(null)}
      />

      {/* Create-lab modal */}
      {showCreateModal && (
        <Modal onClose={() => !createBusy && setShowCreateModal(false)} title="Create new lab">
          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Lab 5: Bluetooth basics"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                required
                disabled={createBusy}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Description
              </label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Short summary students see on the card."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                rows={3}
                disabled={createBusy}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Order (optional)
              </label>
              <input
                type="number"
                value={createOrder}
                onChange={(e) => setCreateOrder(e.target.value)}
                placeholder="Leave blank to auto-append at end"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                disabled={createBusy}
              />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              New labs are created <strong>locked</strong>. Use the lab card's Unlock button to open it up to students.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={createBusy}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button type="submit" disabled={createBusy} className="btn-primary text-sm">
                {createBusy ? 'Creating…' : 'Create lab'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Clone modal */}
      {cloneModalFor && (
        <Modal onClose={() => !cloneBusy && setCloneModalFor(null)} title={`Clone ${cloneModalFor}`}>
          <form onSubmit={handleCloneSubmit} className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Creates a new locked copy of <code className="font-mono">{cloneModalFor}</code>,
              including its structured content.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                New title
              </label>
              <input
                type="text"
                value={cloneTitle}
                onChange={(e) => setCloneTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                disabled={cloneBusy}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                New lab ID (optional)
              </label>
              <input
                type="text"
                value={cloneNewId}
                onChange={(e) => setCloneNewId(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                disabled={cloneBusy}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCloneModalFor(null)}
                disabled={cloneBusy}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button type="submit" disabled={cloneBusy} className="btn-primary text-sm">
                {cloneBusy ? 'Cloning…' : 'Clone'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Schedule unlock modal */}
      {scheduleModalFor && (
        <Modal
          onClose={() => !scheduleBusy && setScheduleModalFor(null)}
          title={`Schedule unlock for ${scheduleModalFor}`}
        >
          <form onSubmit={handleScheduleSubmit} className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              The lab will auto-unlock for all students at the chosen local time.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Unlock at
              </label>
              <input
                type="datetime-local"
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                required
                disabled={scheduleBusy}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleModalFor(null)}
                disabled={scheduleBusy}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduleBusy || !scheduleValue}
                className="btn-primary text-sm"
              >
                {scheduleBusy ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal (dry-run → commit) */}
      {deleteModalFor && (
        <Modal
          onClose={() => deleteStep !== 'committing' && closeDeleteModal()}
          title={`Delete ${deleteModalFor}`}
          wide
        >
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              Deleting a lab cascades to every student's progress, grades, submissions, and checkoffs
              for this lab. This cannot be undone.
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Type <code className="font-mono">{deleteModalFor}</code> to enable the buttons
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteModalFor}
                disabled={deleteStep === 'committing' || deleteStep === 'done'}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
              />
            </div>

            {deleteStep === 'idle' && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDryRun}
                  disabled={!deleteConfirmMatches}
                  className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                >
                  Run dry-run
                </button>
              </div>
            )}

            {deleteStep === 'dry-running' && (
              <div className="text-gray-600 dark:text-gray-400">Running dry-run…</div>
            )}

            {(deleteStep === 'dry-run-done' || deleteStep === 'committing') && deleteDryRun && (
              <div className="p-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10">
                <div className="font-semibold text-red-700 dark:text-red-300 mb-2">
                  Dry-run preview — nothing has been deleted yet
                </div>
                <DeletionCountsTable
                  deleted={deleteDryRun.deleted}
                  s3ObjectsDeleted={deleteDryRun.s3ObjectsDeleted}
                />
                {deleteStep === 'dry-run-done' && (
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeDeleteModal}
                      className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCommit}
                      disabled={!deleteConfirmMatches}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                    >
                      Commit delete
                    </button>
                  </div>
                )}
                {deleteStep === 'committing' && (
                  <div className="mt-3 text-red-700 dark:text-red-300">Deleting…</div>
                )}
              </div>
            )}

            {deleteStep === 'done' && deleteResult && (
              <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <div className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                  Deleted {deleteResult.labId}
                </div>
                <DeletionCountsTable
                  deleted={deleteResult.deleted}
                  s3ObjectsDeleted={deleteResult.s3ObjectsDeleted}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------- Local sub-components ----------

const Modal: React.FC<{
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, onClose, wide, children }) => {
  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative bg-white dark:bg-surface-dark-alt rounded-2xl shadow-2xl p-6 w-full ${
          wide ? 'max-w-2xl' : 'max-w-md'
        } mx-4 border border-gray-200 dark:border-gray-700`}
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-display font-bold text-secondary-700 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const DeletionCountsTable: React.FC<{
  deleted: Record<string, number>;
  s3ObjectsDeleted: number;
}> = ({ deleted, s3ObjectsDeleted }) => {
  const rows = Object.entries(deleted || {});
  const total = rows.reduce((s, [, n]) => s + (n || 0), 0);
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
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400" colSpan={2}>
                (nothing to delete)
              </td>
            </tr>
          )}
          {rows.map(([k, n]) => (
            <tr key={k} className="border-t border-gray-200 dark:border-gray-800">
              <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">{k}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
                {(n || 0).toLocaleString()}
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

export default LabsPage;
