// Resolves how a lab (or a single part of it) gets checked off.
//
// Why this exists: the in-person-checkoff behaviour used to be gated on the
// literal `labId === 'lab0'` in four places. That only ever worked for the
// legacy hand-seeded ids. Labs created through the admin console get an
// auto-generated id like `lab-d863b906` (see labDisplay.ts for the same
// problem with badge labels), so every one of those checks silently became
// false — putting a video uploader on a lab that is checked off in person.
//
// Resolution order:
//   1. the part's own `checkoffMode` (per-part override)
//   2. the lab's `checkoffMode` (what the admin picked in the lab editor)
//   3. legacy: a hardcoded `lab0` id still means in-person
//   4. 'video' — the default for every other lab

import { LabCheckoffMode, LabSection } from '../types';

interface LabLike {
  labId?: string;
  checkoffMode?: LabCheckoffMode;
}

export const DEFAULT_CHECKOFF_MODE: LabCheckoffMode = 'video';

export function resolveLabCheckoffMode(
  lab: LabLike | null | undefined
): LabCheckoffMode {
  if (lab?.checkoffMode) return lab.checkoffMode;

  // Legacy fallback for labs seeded before checkoffMode existed.
  if (lab?.labId && /^lab0$/i.test(lab.labId)) return 'in-person';

  return DEFAULT_CHECKOFF_MODE;
}

export function resolvePartCheckoffMode(
  lab: LabLike | null | undefined,
  section?: Pick<LabSection, 'checkoffMode'> | null
): LabCheckoffMode {
  return section?.checkoffMode || resolveLabCheckoffMode(lab);
}
