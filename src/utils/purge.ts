// Helpers for the destructive-ops endpoints shipped in Wave 5.
//
// IMPORTANT: these URLs do NOT share a single prefix — the backend scattered
// them across three resource trees intentionally:
//
//   - /admin/terms/{termId}/...           — term-scoped destructive ops
//   - /admin/media/orphaned               — S3 orphan cleanup
//   - /students/{studentName}/reset-progress — single-student wipe (sits on
//                                             the existing /students tree)
//
// An earlier version of this file assumed a common `/admin/purge/*` prefix.
// That prefix never existed, which is why hitting any purge endpoint failed
// with a browser-level "NetworkError" (API Gateway had no matching route, so
// its 403 response carried no CORS headers, so Firefox/Chrome rejected it
// before it reached our fetch handler).

import { API_ENDPOINT } from '../aws-config';

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

export interface TermUsage {
  termId: string;
  isActive: boolean;
  tables: Record<string, { count: number; queried: 'scan' | 'gsi' }>;
  s3: { videos: { objectCount: number; totalBytes: number; estimatedBasedOn: string } };
  totalRows: number;
  lastSnapshot: { snapshotId: string; archiveUri: string; createdAt: string } | null;
}

export interface SnapshotResult {
  termId: string;
  snapshotId: string;
  archiveUri: string;
  rowsArchived: number;
  manifestKey: string;
  durationMs: number;
}

export interface PurgeResult {
  termId: string;
  dryRun: boolean;
  snapshotId?: string;
  deleted: Record<string, number>;
  s3ObjectsDeleted: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface OrphanedMedia {
  scanned: number;
  orphanCount: number;
  deletedCount?: number;
  samples: string[];
  dryRun: boolean;
}

export interface StudentResetResult {
  studentId: string;
  termId: string;
  deleted: { progress: number; grades: number; status: number; submissions: number };
  s3ObjectsDeleted: number;
}

// ---------- Calls ----------

export async function fetchTermUsage(termId: string): Promise<TermUsage> {
  const res = await fetch(
    `${base()}/admin/terms/${encodeURIComponent(termId)}/usage`,
    { headers: authHeaders() }
  );
  return parseOrThrow(res) as Promise<TermUsage>;
}

export async function createSnapshot(termId: string): Promise<SnapshotResult> {
  const res = await fetch(
    `${base()}/admin/terms/${encodeURIComponent(termId)}/snapshot`,
    {
      method: 'POST',
      headers: authHeaders(),
    }
  );
  return parseOrThrow(res) as Promise<SnapshotResult>;
}

export async function purgeTermData(
  termId: string,
  dryRun: boolean
): Promise<PurgeResult> {
  // X-Confirmation-Token must equal the termId in the path — the backend
  // rejects the request otherwise. It's a belt-and-braces guard against
  // accidentally nuking sp26 when you meant sp27.
  const qs = `?dryRun=${dryRun ? 'true' : 'false'}`;
  const res = await fetch(
    `${base()}/admin/terms/${encodeURIComponent(termId)}/data${qs}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
        'X-Confirmation-Token': termId,
      },
    }
  );
  return parseOrThrow(res) as Promise<PurgeResult>;
}

export async function resetStudentProgress(
  studentName: string
): Promise<StudentResetResult> {
  // This one's a POST (not a DELETE) because the endpoint scopes to the
  // currently active term only — calling it again is idempotent for that
  // term but resets nothing for other terms. POST is the conventional
  // verb for "run this stateful command".
  const res = await fetch(
    `${base()}/students/${encodeURIComponent(studentName)}/reset-progress`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );
  return parseOrThrow(res) as Promise<StudentResetResult>;
}

export async function listOrphanedMedia(): Promise<OrphanedMedia> {
  const res = await fetch(`${base()}/admin/media/orphaned`, {
    headers: authHeaders(),
  });
  return parseOrThrow(res) as Promise<OrphanedMedia>;
}

export async function deleteOrphanedMedia(): Promise<OrphanedMedia> {
  const res = await fetch(`${base()}/admin/media/orphaned`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseOrThrow(res) as Promise<OrphanedMedia>;
}
