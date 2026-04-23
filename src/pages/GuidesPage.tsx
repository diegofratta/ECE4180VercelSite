import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Guide } from '../types';
import { API_ENDPOINT } from '../aws-config';
import GuideCard from '../components/guides/GuideCard';
import { isStaffLevel, isAdmin } from '../utils/roles';
import { cloneGuide, deleteGuide, reorderGuides } from '../utils/guides';

type SortOption = 'tag' | 'title' | 'newest' | 'oldest';
type Toast = { kind: 'ok' | 'err'; msg: string };

const GuidesPage: React.FC = () => {
  const { authState, viewAsStudent } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('tag');
  const [filterTag, setFilterTag] = useState<string>('all');

  const isStaff = isStaffLevel(authState.user);
  const isAdminUser = isAdmin(authState.user);
  const showAdminControls = isAdminUser && !viewAsStudent;

  const [toast, setToast] = useState<Toast | null>(null);

  // Reorder state
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Per-guide admin menu
  const [openMenuGuideId, setOpenMenuGuideId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Clone modal
  const [cloneModalFor, setCloneModalFor] = useState<string | null>(null);
  const [cloneTitle, setCloneTitle] = useState('');
  const [cloneNewId, setCloneNewId] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);

  // Delete modal
  const [deleteModalFor, setDeleteModalFor] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'committing' | 'done'>('idle');

  useEffect(() => {
    fetchGuides();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!openMenuGuideId) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuGuideId(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenuGuideId]);

  const fetchGuides = async () => {
    try {
      setLoading(true);
      setError(null);

      const idToken = localStorage.getItem('idToken');

      if (!idToken) {
        throw new Error('No authentication token found');
      }

      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}guides`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch guides');
      }

      const data = await response.json();
      setGuides(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching guides:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique tags
  const uniqueTags = useMemo(() => {
    const tags = guides
      .map((g) => g.tag?.trim())
      .filter((t): t is string => !!t);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [guides]);

  // Filter and sort guides
  const sortedGuides = useMemo(() => {
    let filtered = filterTag === 'all'
      ? [...guides]
      : guides.filter((g) => g.tag?.trim() === filterTag);

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'tag': {
          const tagA = a.tag?.trim() || '';
          const tagB = b.tag?.trim() || '';
          const cmp = tagA.localeCompare(tagB, undefined, { numeric: true });
          return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
        }
        case 'title':
          return a.title.localeCompare(b.title);
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [guides, sortBy, filterTag]);

  // ---------- Admin toolbar handlers ----------

  function startReorderMode() {
    const sortedIds = [...guides]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((g) => g.guideId);
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
    const orders = reorderList.map((guideId, i) => ({ guideId, order: i + 1 }));
    try {
      setSavingOrder(true);
      const res = await reorderGuides(orders);
      setToast({
        kind: res.failed?.length ? 'err' : 'ok',
        msg: `Reorder: ${res.updated} updated${
          res.failed?.length ? `, ${res.failed.length} failed` : ''
        }`,
      });
      exitReorderMode();
      await fetchGuides();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setSavingOrder(false);
    }
  }

  // ---------- Per-guide admin handlers ----------

  function openCloneModal(guideId: string, currentTitle: string) {
    setOpenMenuGuideId(null);
    setCloneModalFor(guideId);
    setCloneTitle(`${currentTitle} (copy)`);
    setCloneNewId('');
  }

  async function handleCloneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cloneModalFor) return;
    try {
      setCloneBusy(true);
      const overrides: { newGuideId?: string; title?: string } = {};
      if (cloneNewId.trim()) overrides.newGuideId = cloneNewId.trim();
      if (cloneTitle.trim()) overrides.title = cloneTitle.trim();
      const g = await cloneGuide(cloneModalFor, overrides);
      setToast({ kind: 'ok', msg: `Cloned to ${g.guideId}` });
      setCloneModalFor(null);
      await fetchGuides();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setCloneBusy(false);
    }
  }

  function openDeleteModal(guideId: string) {
    setOpenMenuGuideId(null);
    setDeleteModalFor(guideId);
    setDeleteConfirmText('');
    setDeleteStep('idle');
  }

  function closeDeleteModal() {
    setDeleteModalFor(null);
    setDeleteConfirmText('');
    setDeleteStep('idle');
  }

  async function handleDeleteCommit() {
    if (!deleteModalFor) return;
    try {
      setDeleteBusy(true);
      setDeleteStep('committing');
      await deleteGuide(deleteModalFor, false);
      setDeleteStep('done');
      setToast({ kind: 'ok', msg: `Deleted ${deleteModalFor}` });
      closeDeleteModal();
      await fetchGuides();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
      setDeleteStep('idle');
    } finally {
      setDeleteBusy(false);
    }
  }

  const deleteConfirmMatches =
    !!deleteModalFor && deleteConfirmText.trim() === deleteModalFor;

  if (loading && guides.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
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

  const guidesById = new Map(guides.map((g) => [g.guideId, g]));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Guides</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Specialized tutorials and setup guides for embedded systems development.
          </p>
        </div>

        {/* Staff: New Guide Button (existing — unchanged) */}
        {isStaff && (
          <Link
            to="/guides/new"
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Guide
          </Link>
        )}
      </div>

      {/* Toast */}
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
                Guide admin controls
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Reorder the guide catalog, clone an existing guide, or delete one.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (reorderMode ? exitReorderMode() : startReorderMode())}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                reorderMode
                  ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                  : 'border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
              }`}
            >
              {reorderMode ? 'Exit reorder mode' : 'Reorder guides'}
            </button>
          </div>

          {reorderMode && (
            <div className="mt-4 p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-900/10">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Use the up/down arrows to change the order. Click "Save order" to commit.
              </div>
              <ul className="space-y-1">
                {reorderList.map((guideId, idx) => {
                  const g = guidesById.get(guideId);
                  return (
                    <li
                      key={guideId}
                      className="flex items-center justify-between gap-3 p-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    >
                      <div className="text-sm text-gray-800 dark:text-gray-100 truncate">
                        <code className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">
                          {idx + 1}.
                        </code>
                        <span className="font-medium">{g?.title || guideId}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({guideId})
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
      <div className="grid grid-cols-1 gap-4 mb-8 animate-slide-up">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{guides.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Available Guides</p>
          </div>
        </div>
      </div>

      {/* Filter & Sort Controls */}
      {guides.length > 0 && (
        <div className="mb-8 animate-slide-up animation-delay-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Tag Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-1">Filter:</span>
              <button
                onClick={() => setFilterTag('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  filterTag === 'all'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    filterTag === tag
                      ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="tag">Tag</option>
                <option value="title">A–Z</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {/* Filtered count */}
          {filterTag !== 'all' && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Showing {sortedGuides.length} of {guides.length} guides
            </p>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3 animate-shake">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Error Loading Guides</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-slide-up animation-delay-100">
        {sortedGuides.map((guide, index) => (
          <div
            key={guide.guideId}
            className="relative"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <GuideCard
              guide={guide}
              isStaff={isStaff}
            />

            {/* Admin action dropdown — admin only */}
            {showAdminControls && (
              <div className="absolute top-2 right-2 z-20">
                <div
                  className="relative"
                  ref={openMenuGuideId === guide.guideId ? menuRef : undefined}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={openMenuGuideId === guide.guideId}
                    onClick={() =>
                      setOpenMenuGuideId(
                        openMenuGuideId === guide.guideId ? null : guide.guideId
                      )
                    }
                    className="w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow hover:bg-white dark:hover:bg-gray-800"
                    title="Admin actions"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
                    </svg>
                  </button>

                  {openMenuGuideId === guide.guideId && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 text-sm"
                    >
                      <Link
                        to={`/guides/${guide.guideId}/edit`}
                        onClick={() => setOpenMenuGuideId(null)}
                        className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        role="menuitem"
                      >
                        Edit content
                      </Link>
                      <button
                        type="button"
                        onClick={() => openCloneModal(guide.guideId, guide.title)}
                        className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        role="menuitem"
                      >
                        Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal(guide.guideId)}
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
      {guides.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No guides available yet.</p>
          {isStaff && (
            <Link
              to="/guides/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Guide
            </Link>
          )}
        </div>
      )}

      {/* Clone modal */}
      {cloneModalFor && (
        <Modal onClose={() => !cloneBusy && setCloneModalFor(null)} title={`Clone ${cloneModalFor}`}>
          <form onSubmit={handleCloneSubmit} className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Creates a deep copy of <code className="font-mono">{cloneModalFor}</code>.
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
                New guide ID (optional)
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

      {/* Delete modal */}
      {deleteModalFor && (
        <Modal
          onClose={() => deleteStep !== 'committing' && closeDeleteModal()}
          title={`Delete ${deleteModalFor}`}
        >
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              Deleting a guide removes it and any attached content permanently. This cannot be
              undone.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Type <code className="font-mono">{deleteModalFor}</code> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteModalFor}
                disabled={deleteBusy}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteBusy}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCommit}
                disabled={!deleteConfirmMatches || deleteBusy}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Commit delete'}
              </button>
            </div>
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
  children: React.ReactNode;
}> = ({ title, onClose, children }) => {
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
      <div className="relative bg-white dark:bg-surface-dark-alt rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">
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

export default GuidesPage;
