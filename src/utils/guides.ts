// Helpers for talking to the /admin/guides endpoints. Mirrors utils/labs.ts
// and utils/terms.ts: typed async helpers, throws on non-ok, pulls the
// idToken from localStorage.

import { API_ENDPOINT } from '../aws-config';
import { Guide } from '../types';

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

export interface DeleteGuideResult {
  guideId: string;
  dryRun: boolean;
  deleted?: Record<string, number>;
  durationMs?: number;
}

export interface ReorderGuidesResult {
  updated: number;
  failed: any[];
}

export async function deleteGuide(
  guideId: string,
  dryRun: boolean
): Promise<DeleteGuideResult> {
  const qs = `?dryRun=${dryRun ? 'true' : 'false'}`;
  const res = await fetch(
    `${base()}/admin/guides/${encodeURIComponent(guideId)}${qs}`,
    {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
        'X-Confirmation-Token': guideId,
      },
    }
  );
  return parseOrThrow(res) as Promise<DeleteGuideResult>;
}

export async function cloneGuide(
  guideId: string,
  overrides?: { newGuideId?: string; title?: string }
): Promise<Guide> {
  const res = await fetch(
    `${base()}/admin/guides/${encodeURIComponent(guideId)}/clone`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {}),
    }
  );
  return parseOrThrow(res) as Promise<Guide>;
}

export async function reorderGuides(
  orders: Array<{ guideId: string; order: number }>
): Promise<ReorderGuidesResult> {
  const res = await fetch(`${base()}/admin/guides/reorder`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders }),
  });
  return parseOrThrow(res) as Promise<ReorderGuidesResult>;
}
