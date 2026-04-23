// Helpers for talking to the /admin/labs endpoints plus the per-lab
// unlock/lock routes. Extracted into a shared module so the LabsPage
// (and anything else that wants to poke labs) doesn't duplicate the
// fetch/auth boilerplate. Mirrors utils/terms.ts and utils/purge.ts.

import { API_ENDPOINT } from '../aws-config';
import { Lab } from '../types';

const base = () => API_ENDPOINT.replace(/\/$/, '');

function authHeaders(): Record<string, string> {
  const idToken = localStorage.getItem('idToken');
  if (!idToken) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${idToken}` };
}

async function parseOrThrow(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// ---------- Types ----------

export interface CreateLabInput {
  title: string;
  description?: string;
  order?: number;
  structuredContent?: any;
  dueDate?: string;
}

export interface DeleteLabResult {
  labId: string;
  dryRun: boolean;
  deleted: Record<string, number>;
  s3ObjectsDeleted: number;
  durationMs: number;
}

export interface ReorderResult {
  updated: number;
  failed: any[];
}

// ---------- /admin/labs CRUD ----------

export async function createLab(input: CreateLabInput): Promise<Lab> {
  const res = await fetch(`${base()}/admin/labs`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res) as Promise<Lab>;
}

export async function deleteLab(
  labId: string,
  dryRun: boolean
): Promise<DeleteLabResult> {
  const qs = `?dryRun=${dryRun ? 'true' : 'false'}`;
  const res = await fetch(
    `${base()}/admin/labs/${encodeURIComponent(labId)}${qs}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
        'X-Confirmation-Token': labId,
      },
    }
  );
  return parseOrThrow(res) as Promise<DeleteLabResult>;
}

export async function cloneLab(
  labId: string,
  overrides?: { newLabId?: string; title?: string; description?: string }
): Promise<Lab> {
  const res = await fetch(
    `${base()}/admin/labs/${encodeURIComponent(labId)}/clone`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {}),
    }
  );
  return parseOrThrow(res) as Promise<Lab>;
}

export async function reorderLabs(
  orders: Array<{ labId: string; order: number }>
): Promise<ReorderResult> {
  const res = await fetch(`${base()}/admin/labs/reorder`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders }),
  });
  return parseOrThrow(res) as Promise<ReorderResult>;
}

export async function bulkLockLabs(labIds: string[] | 'all'): Promise<any> {
  const res = await fetch(`${base()}/admin/labs/bulk-lock`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ labIds }),
  });
  return parseOrThrow(res);
}

export async function bulkUnlockLabs(labIds: string[] | 'all'): Promise<any> {
  const res = await fetch(`${base()}/admin/labs/bulk-unlock`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ labIds }),
  });
  return parseOrThrow(res);
}

export async function scheduleUnlockLab(
  labId: string,
  unlockAt: string
): Promise<any> {
  const res = await fetch(
    `${base()}/admin/labs/${encodeURIComponent(labId)}/schedule-unlock`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlockAt }),
    }
  );
  return parseOrThrow(res);
}

export async function cancelScheduledUnlock(labId: string): Promise<any> {
  const res = await fetch(
    `${base()}/admin/labs/${encodeURIComponent(labId)}/schedule-unlock`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );
  return parseOrThrow(res);
}

// ---------- /labs/{id}/{unlock,lock} (existing, migrated off raw fetch) ----------
//
// These aren't under /admin/* — they predate the admin namespace — but we
// expose them here so the LabsPage can have a single import for every lab
// mutation it needs to do.

export async function unlockLab(labId: string): Promise<any> {
  const res = await fetch(
    `${base()}/labs/${encodeURIComponent(labId)}/unlock`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    }
  );
  return parseOrThrow(res);
}

export async function lockLab(labId: string): Promise<any> {
  const res = await fetch(
    `${base()}/labs/${encodeURIComponent(labId)}/lock`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    }
  );
  return parseOrThrow(res);
}
