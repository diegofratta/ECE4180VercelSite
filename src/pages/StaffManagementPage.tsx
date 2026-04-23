// Staff Management (Wave 3).
//
// Admin-only page for promoting/demoting TAs and admins without a redeploy.
// Source of truth lives in SSM (the allowlists); this page merges that
// with the live Cognito directory to show who's signed up, who's still
// just on the allowlist waiting for first login, etc.

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINT } from '../aws-config';
import { StaffListResponse, StaffUser, UserRole } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RowBusyState = 'idle' | 'updating' | 'removing' | 'revoking';

const StaffManagementPage: React.FC = () => {
  const { authState } = useAuth();
  const [data, setData] = useState<StaffListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'ta' | 'admin'>('ta');
  const [adding, setAdding] = useState(false);

  const [rowBusy, setRowBusy] = useState<Record<string, RowBusyState>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ta' | 'admin' | 'student'>('all');

  const apiBase = useMemo(() => API_ENDPOINT.replace(/\/$/, ''), []);

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) throw new Error('Not authenticated');
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${idToken}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(`${apiBase}${path}`, { ...init, headers });
  }

  async function fetchStaff() {
    try {
      setLoading(true);
      setError(null);
      const res = await authedFetch('/admin/staff');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load staff (HTTP ${res.status})`);
      }
      const json: StaffListResponse = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setToast({ kind: 'err', msg: 'Please enter a valid email' });
      return;
    }
    try {
      setAdding(true);
      const res = await authedFetch('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({ email, role: newRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed (HTTP ${res.status})`);
      setToast({ kind: 'ok', msg: `${email} granted ${newRole}${body.cognitoUpdated ? ' — session revoked so change takes effect on next sign-in' : ' — will apply on their first sign-in'}` });
      setNewEmail('');
      await fetchStaff();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setAdding(false);
    }
  }

  async function handleChangeRole(u: StaffUser, role: UserRole) {
    if (role === u.role) return;
    try {
      setRowBusy((s) => ({ ...s, [u.email]: 'updating' }));
      const res = await authedFetch(`/admin/staff/${encodeURIComponent(u.email)}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed (HTTP ${res.status})`);
      setToast({ kind: 'ok', msg: `${u.email}: ${u.role} → ${role}` });
      await fetchStaff();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setRowBusy((s) => ({ ...s, [u.email]: 'idle' }));
    }
  }

  async function handleRemove(u: StaffUser) {
    if (!window.confirm(`Demote ${u.email} to student? Their active sessions will be revoked.`)) return;
    try {
      setRowBusy((s) => ({ ...s, [u.email]: 'removing' }));
      const res = await authedFetch(`/admin/staff/${encodeURIComponent(u.email)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed (HTTP ${res.status})`);
      setToast({ kind: 'ok', msg: `${u.email} demoted to student` });
      await fetchStaff();
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setRowBusy((s) => ({ ...s, [u.email]: 'idle' }));
    }
  }

  async function handleRevoke(u: StaffUser) {
    if (!u.hasAccount) {
      setToast({ kind: 'err', msg: 'User has not signed up yet — no session to revoke' });
      return;
    }
    try {
      setRowBusy((s) => ({ ...s, [u.email]: 'revoking' }));
      const res = await authedFetch(
        `/admin/staff/${encodeURIComponent(u.email)}/revoke-session`,
        { method: 'POST' }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed (HTTP ${res.status})`);
      setToast({ kind: 'ok', msg: `${u.email} session revoked — they'll need to sign in again` });
    } catch (err) {
      setToast({ kind: 'err', msg: (err as Error).message });
    } finally {
      setRowBusy((s) => ({ ...s, [u.email]: 'idle' }));
    }
  }

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q)
      );
    });
  }, [data, search, roleFilter]);

  const counts = useMemo(() => {
    const base = { admins: 0, tas: 0, notSignedUp: 0 };
    if (!data) return base;
    for (const u of data.users) {
      if (u.role === 'admin') base.admins += 1;
      if (u.role === 'ta') base.tas += 1;
      if (!u.hasAccount) base.notSignedUp += 1;
    }
    return base;
  }, [data]);

  const isSelf = (email: string) =>
    (authState.user?.username || '').toLowerCase() === email.toLowerCase();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-secondary-700 dark:text-white">Staff management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Grant or revoke TA and admin access. Changes take effect immediately for signed-up users; unknown emails
          get auto-promoted the first time they sign up.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Admins" value={counts.admins} accent="emerald" />
        <StatCard label="TAs" value={counts.tas} accent="sky" />
        <StatCard label="On allowlist (not signed up)" value={counts.notSignedUp} accent="amber" />
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="card p-4 mb-6 flex flex-col sm:flex-row sm:items-end gap-3"
      >
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Email
          </label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="name@gatech.edu"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gt-gold"
            disabled={adding}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Role
          </label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'ta' | 'admin')}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            disabled={adding}
          >
            <option value="ta">TA</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={adding}>
          {adding ? 'Granting…' : 'Grant access'}
        </button>
      </form>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="all">All roles</option>
          <option value="admin">Admins</option>
          <option value="ta">TAs</option>
          <option value="student">Students (from allowlist leftovers)</option>
        </select>
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

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Email / Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No staff match the current filter.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const busy = rowBusy[u.email] || 'idle';
                const self = isSelf(u.email);
                return (
                  <tr key={u.email} className="border-t border-gray-200 dark:border-gray-800">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {u.fullName || '(no name set)'}
                        {self && (
                          <span className="ml-2 text-xs font-normal text-gt-gold">(you)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        disabled={busy !== 'idle' || self}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                        title={self ? 'You cannot change your own role here' : undefined}
                      >
                        <option value="student">student</option>
                        <option value="ta">ta</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge user={u} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleRevoke(u)}
                        disabled={busy !== 'idle' || !u.hasAccount || self}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 mr-2"
                      >
                        {busy === 'revoking' ? '…' : 'Revoke session'}
                      </button>
                      <button
                        onClick={() => handleRemove(u)}
                        disabled={busy !== 'idle' || self}
                        className="text-xs px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        {busy === 'removing' ? '…' : 'Demote'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; accent: string }> = ({ label, value, accent }) => (
  <div className={`card p-4 border-l-4 border-l-${accent}-500`}>
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 text-3xl font-display font-bold text-secondary-700 dark:text-white">{value}</div>
  </div>
);

const StatusBadge: React.FC<{ user: StaffUser }> = ({ user }) => {
  if (!user.hasAccount) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        On allowlist — not signed up
      </span>
    );
  }
  if (!user.enabled) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
        Disabled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
      {user.status || 'Active'}
    </span>
  );
};

export default StaffManagementPage;
