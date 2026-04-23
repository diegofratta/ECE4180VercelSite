// Helpers for talking to the /admin/terms endpoints. Extracted into a
// shared module so the Header badge and the TermsPage don't duplicate
// the fetch logic.

import { API_ENDPOINT } from '../aws-config';
import {
  CurrentTermResponse,
  Term,
  TermListResponse,
} from '../types';

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

export async function fetchCurrentTerm(): Promise<CurrentTermResponse> {
  const res = await fetch(`${base()}/admin/terms/current`, { headers: authHeaders() });
  return parseOrThrow(res) as Promise<CurrentTermResponse>;
}

export async function fetchAllTerms(): Promise<TermListResponse> {
  const res = await fetch(`${base()}/admin/terms`, { headers: authHeaders() });
  return parseOrThrow(res) as Promise<TermListResponse>;
}

export async function createTerm(input: {
  termId: string;
  displayName: string;
  startDate?: string;
  endDate?: string;
  activate?: boolean;
}): Promise<Term> {
  const res = await fetch(`${base()}/admin/terms`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow(res) as Promise<Term>;
}

export async function updateTerm(
  termId: string,
  patch: Partial<Pick<Term, 'displayName' | 'startDate' | 'endDate' | 'status'>>
): Promise<Term> {
  const res = await fetch(`${base()}/admin/terms/${encodeURIComponent(termId)}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseOrThrow(res) as Promise<Term>;
}

export async function activateTerm(termId: string): Promise<{ termId: string; activatedAt: string }> {
  const res = await fetch(`${base()}/admin/terms/${encodeURIComponent(termId)}/activate`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  return parseOrThrow(res);
}

export async function deleteTerm(termId: string): Promise<{ deleted: string }> {
  const res = await fetch(`${base()}/admin/terms/${encodeURIComponent(termId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseOrThrow(res);
}

/**
 * Valid term IDs: sp/su/fa/wi + two-digit year. Example: "sp26", "fa27".
 * Mirrors backend shared/term.js so client and server stay in sync.
 */
export const TERM_ID_RE = /^(sp|su|fa|wi)\d{2}$/;

export function describeTerm(termId: string): string {
  const m = TERM_ID_RE.exec(termId);
  if (!m) return termId;
  const season = { sp: 'Spring', su: 'Summer', fa: 'Fall', wi: 'Winter' }[m[1]] || m[1];
  const year = `20${termId.slice(2)}`;
  return `${season} ${year}`;
}
