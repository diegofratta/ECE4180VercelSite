// Helpers for talking to the /admin/health, /admin/data/* endpoints (Wave 8).
// Mirrors utils/terms.ts exactly for the fetch / auth / error-handling
// boilerplate. Four responsibilities:
//   1. System health snapshot   (ta+)
//   2. Inconsistency checks     (staff+)
//   3. Reconciliation           (admin)
//   4. Raw DynamoDB table viewer (admin)
//
// Query-string building is hand-rolled via URLSearchParams — no extra deps
// for serializing a handful of optional params.
//
// All responses that include a list of samples / items are returned as
// `any[]` because the shape varies by table; the page is responsible for
// rendering heterogeneous item shapes.

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

export interface HealthSnapshot {
  timestamp: string;
  activeTerm: string;
  tables: Record<string, { count: number }>;
  s3: {
    checkoffVideos: { objectCount: number; totalBytes: number };
    archives: { objectCount: number; totalBytes: number };
  };
  cognito: { userCount: number; confirmedCount: number };
  lastAuditAt: string | null;
}

export interface InconsistencyCheck {
  id: string;
  label: string;
  count: number;
  samples?: any[];
  canReconcile?: boolean;
  note?: string;
  error?: string;
}

export interface InconsistenciesResponse {
  checkedAt: string;
  durationMs: number;
  checks: InconsistencyCheck[];
}

export interface ReconcileRequest {
  checks: string[];
  dryRun: boolean;
}

export interface ReconcileResult {
  dryRun: boolean;
  results: { id: string; found: number; fixed: number; failed: any[] }[];
}

export interface TableRowsResponse {
  tableName: string;
  items: any[];
  count: number;
  nextToken: string | null;
  scannedCount: number;
}

// ---------- Calls ----------

export async function fetchHealth(): Promise<HealthSnapshot> {
  const res = await fetch(`${base()}/admin/health`, { headers: authHeaders() });
  return parseOrThrow(res) as Promise<HealthSnapshot>;
}

export async function fetchInconsistencies(
  deep = false
): Promise<InconsistenciesResponse> {
  const qs = deep ? '?deep=true' : '?deep=false';
  const res = await fetch(`${base()}/admin/data/inconsistencies${qs}`, {
    headers: authHeaders(),
  });
  return parseOrThrow(res) as Promise<InconsistenciesResponse>;
}

export async function reconcile(
  req: ReconcileRequest
): Promise<ReconcileResult> {
  const res = await fetch(`${base()}/admin/data/reconcile`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return parseOrThrow(res) as Promise<ReconcileResult>;
}

export async function fetchTableRows(
  tableName: string,
  opts: {
    limit?: number;
    nextToken?: string;
    filterKey?: string;
    filterValue?: string;
  } = {}
): Promise<TableRowsResponse> {
  const qs = new URLSearchParams();
  if (typeof opts.limit === 'number') qs.append('limit', String(opts.limit));
  if (opts.nextToken) qs.append('nextToken', opts.nextToken);
  if (opts.filterKey) qs.append('filterKey', opts.filterKey);
  if (opts.filterValue) qs.append('filterValue', opts.filterValue);
  const s = qs.toString();
  const res = await fetch(
    `${base()}/admin/data/table/${encodeURIComponent(tableName)}${s ? `?${s}` : ''}`,
    { headers: authHeaders() }
  );
  return parseOrThrow(res) as Promise<TableRowsResponse>;
}

// ---------- Whitelist (mirrors backend TABLES in admin-health.js) ----------
// Kept here so the DataInspectorPage table-viewer dropdown always matches the
// backend allow-list. Touch both sides in lockstep.

export const WHITELISTED_TABLES: string[] = [
  'ece4180-students',
  'ece4180-labs-v1',
  'ece4180-guides',
  'ece4180-lab-status-v2',
  'ece4180-lab-progress',
  'ece4180-lab-grades',
  'ece4180-part-submissions',
  'ece4180-submissions',
  'ece4180-checkoff-audit-log',
  'ece4180-terms',
  'ece4180-config',
  'ece4180-lab-queue',
  'ece4180-partner-requests',
];
