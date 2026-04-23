// Central role helpers. Previously every page/component reached in and
// tested `user.role === 'staff'`, which (a) scatters the role model across
// 13 files and (b) can't distinguish TA from full admin.
//
// Role hierarchy (same as backend shared/auth.js):
//   student (1) < ta (2) < admin (3)
//
// Legacy compatibility: the old 'staff' value is aliased to 'admin'. Tokens
// issued before the Wave 2 migration still carry role:staff; this keeps
// them working until they refresh.

import { User } from '../types';

export type Role = 'student' | 'ta' | 'admin';

export const ROLE_RANK: Record<Role, number> = {
  student: 1,
  ta: 2,
  admin: 3,
};

/** Canonicalize whatever came out of Cognito into one of our three values. */
export function normalizeRole(raw: string | undefined | null): Role {
  if (!raw) return 'student';
  const lower = raw.toLowerCase().trim();
  if (lower === 'staff') return 'admin'; // legacy alias
  if (lower === 'ta' || lower === 'admin' || lower === 'student') {
    return lower;
  }
  return 'student';
}

/** True iff user's rank >= minRole's rank. */
export function hasRole(user: User | null | undefined, minRole: Role): boolean {
  if (!user) return false;
  const have = ROLE_RANK[normalizeRole(user.role)] || 0;
  const need = ROLE_RANK[minRole] || 0;
  return have >= need;
}

/** Used almost everywhere: "does this user get any admin/staff surfaces?" */
export const isStaffLevel = (user: User | null | undefined) => hasRole(user, 'ta');

/** Used for the destructive stuff (term purge, role changes, etc.) */
export const isAdmin = (user: User | null | undefined) => hasRole(user, 'admin');

/** Read-friendly aliases. */
export const isTAOrAbove = isStaffLevel;
export const canGrade = isStaffLevel;
export const canManageLabs = (user: User | null | undefined) => hasRole(user, 'admin');
export const canManageRoles = (user: User | null | undefined) => hasRole(user, 'admin');

/**
 * The effective role to *render* the UI at, considering the
 * "view as student" toggle that staff-level users have. A TA with
 * viewAsStudent=true sees the student UI.
 */
export function displayRole(user: User | null | undefined, viewAsStudent: boolean): Role {
  if (!user) return 'student';
  const r = normalizeRole(user.role);
  if (viewAsStudent && r !== 'student') return 'student';
  return r;
}
