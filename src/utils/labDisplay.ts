// Resolves the short, human-facing label for a lab — the badge on lab cards
// and the number in the lab detail header.
//
// Why this exists: the UI used to derive the label with
// `lab.labId.replace('lab', '')`. That only ever worked for the legacy
// `lab0`/`lab1` ids. Labs created through the admin console get an
// auto-generated id like `lab-d863b906`, which that expression turned into
// `-d863b906` — overflowing the badge and showing a random string to
// students. labId is a partition key referenced by five other tables, so it
// can't be renamed to something friendly; the label is stored separately as
// `displayName` instead.
//
// Resolution order:
//   1. `displayName` — what the admin typed when creating the lab
//   2. `order` — the lab's position, a sane numeric fallback
//   3. the digits in `labId` — recovers "0" from legacy `lab0`
//   4. "?" — nothing usable, but never render a raw uuid fragment

interface LabLike {
  labId?: string;
  displayName?: string;
  order?: number;
}

export function labDisplayLabel(lab: LabLike | null | undefined): string {
  if (!lab) return '?';

  const displayName = lab.displayName?.trim();
  if (displayName) return displayName;

  if (typeof lab.order === 'number' && Number.isFinite(lab.order)) {
    return String(lab.order);
  }

  return labelFromLabId(lab.labId);
}

/**
 * Last-resort label for call sites that only have a labId (queue entries and
 * submissions carry a labId but not the lab record). Returns the digits from
 * a legacy id like `lab3`, and never returns a uuid fragment.
 */
export function labelFromLabId(labId: string | null | undefined): string {
  if (!labId) return '?';

  // Legacy ids: lab0, lab1, lab12 -> 0, 1, 12
  const legacy = labId.match(/^lab(\d+)$/i);
  if (legacy) return legacy[1];

  return '?';
}

/**
 * "Lab 3" / "Lab Extra" style prose label, for sentences and toasts.
 * Falls back to the bare labId when nothing better is available, since in
 * prose an id is more useful than a lone "?".
 */
export function labDisplayName(lab: LabLike | null | undefined): string {
  const label = labDisplayLabel(lab);
  if (label !== '?') return `Lab ${label}`;
  return lab?.labId ? `Lab ${lab.labId}` : 'Lab';
}
