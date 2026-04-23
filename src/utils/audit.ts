// Helpers for talking to the /admin/audit endpoints. Mirrors utils/terms.ts
// style for the fetch / auth / error-handling boilerplate.
//
// Query-string building is intentionally hand-rolled (URLSearchParams) so we
// don't pull in a dependency just to serialize a handful of optional params.

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

export interface AuditEntry {
  studentId: string;
  timestamp: string;
  logId: string;
  labId?: string;
  partId?: string;
  action: string;
  performedBy: string;
  performedByName?: string;
  source: string;
  termId?: string;
  details?: any;
}

export interface AuditQueryParams {
  actor?: string;
  action?: string;
  studentId?: string;
  source?: string;
  term?: string;
  since?: string;
  until?: string;
  limit?: number;
  nextToken?: string;
}

export interface AuditListResponse {
  entries: AuditEntry[];
  count: number;
  nextToken: string | null;
  scanMode: string;
  limit: number;
}

export interface AuditActionsResponse {
  actions: string[];
  scanned: number;
}

export interface AuditExportResponse {
  url: string;
  key: string;
  rowCount: number;
  expiresInSeconds: number;
}

// ---------- Helpers ----------

function buildQuery(params: AuditQueryParams): string {
  const qs = new URLSearchParams();
  if (params.actor) qs.append('actor', params.actor);
  if (params.action) qs.append('action', params.action);
  if (params.studentId) qs.append('studentId', params.studentId);
  if (params.source) qs.append('source', params.source);
  if (params.term) qs.append('term', params.term);
  if (params.since) qs.append('since', params.since);
  if (params.until) qs.append('until', params.until);
  if (typeof params.limit === 'number') qs.append('limit', String(params.limit));
  if (params.nextToken) qs.append('nextToken', params.nextToken);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ---------- Calls ----------

export async function fetchAuditEntries(
  params: AuditQueryParams = {}
): Promise<AuditListResponse> {
  const res = await fetch(`${base()}/admin/audit${buildQuery(params)}`, {
    headers: authHeaders(),
  });
  return parseOrThrow(res) as Promise<AuditListResponse>;
}

export async function fetchAuditForStudent(
  studentName: string,
  params: AuditQueryParams = {}
): Promise<AuditListResponse> {
  const res = await fetch(
    `${base()}/admin/audit/${encodeURIComponent(studentName)}${buildQuery(params)}`,
    { headers: authHeaders() }
  );
  return parseOrThrow(res) as Promise<AuditListResponse>;
}

export async function fetchAuditActions(): Promise<AuditActionsResponse> {
  const res = await fetch(`${base()}/admin/audit/actions`, {
    headers: authHeaders(),
  });
  return parseOrThrow(res) as Promise<AuditActionsResponse>;
}

export async function exportAuditCsv(
  params: AuditQueryParams
): Promise<AuditExportResponse> {
  // Server requires at least one of term / studentId / since|until to avoid
  // a $$$-table scan — we trust the caller to satisfy that and surface the
  // backend's 400 if they don't.
  const { limit, nextToken, ...filters } = params;
  const res = await fetch(`${base()}/admin/audit/export`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  return parseOrThrow(res) as Promise<AuditExportResponse>;
}
