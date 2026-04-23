// User types
//
// Role widened in Wave 2: student | ta | admin. The legacy 'staff' value is
// accepted on read (src/utils/roles.ts normalizeRole aliases it to 'admin')
// so pre-migration JWTs keep working until they refresh.
export type UserRole = 'student' | 'ta' | 'admin';

export interface User {
  username: string;
  role: UserRole;
  studentId?: string;
  fullName?: string;
  section?: 'A' | 'B' | 'Staff';
}

// Authentication types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  showNameCollectionModal: boolean;
}

// Lab types
export interface Lab {
  labId: string;
  title: string;
  description: string;
  content: string;
  structuredContent?: LabContent;
  order: number;
  locked: boolean;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  grade?: number | null;
  earlyBirdPoints?: number;
  unlockAt?: string;
}

// Structured lab content types
export interface LabContent {
  sections: LabSection[];
  resources?: LabResource[];
}

export interface LabSection {
  id: string;
  type: 'introduction' | 'objectives' | 'requirements' | 'instructions' | 'submission' | 'custom' | 'overview';
  title: string;
  content: string | LabContentBlock[];
  order: number;
  points?: number;           // Points for this section/part
  isExtraCredit?: boolean;   // If true, not counted toward base 100%
}

export interface LabContentBlock {
  type: 'text' | 'image' | 'code' | 'video' | 'diagram' | 'note' | 'warning' | 'link';
  content: string;
  caption?: string;
  language?: string; // For code blocks
  url?: string; // For images, videos, links, etc.
  scale?: number; // For image blocks — percentage of original pixel size (default 100)
}

export interface LabResource {
  id: string;
  type: 'document' | 'image' | 'video' | 'link';
  title: string;
  description?: string;
  url: string;
}

// Guide types (never locked, unlike Labs)
export interface Guide {
  guideId: string;
  title: string;
  description: string;
  content: string;
  structuredContent?: GuideContent;
  order: number;
  tag?: string; // Descriptive tag like "Lab 0", "Lab 2", "Final Project"
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface GuideContent {
  sections: GuideSection[];
  resources?: LabResource[];  // Reuse LabResource
}

export interface GuideSection {
  id: string;
  type: 'introduction' | 'overview' | 'steps' | 'tips' | 'troubleshooting' | 'custom';
  title: string;
  content: string | LabContentBlock[];  // Reuse LabContentBlock
  order: number;
}

export interface LabStatus {
  studentId: string;
  labId: string;
  status: 'locked' | 'unlocked';
  unlockedAt?: string;
  submissionStatus?: 'pending' | 'approved' | 'rejected';
  submissionId?: string;
  completed: boolean;
  updatedAt: string;
}

// Submission types
export interface Submission {
  submissionId: string;
  labId: string;
  studentId: string;
  userId: string;
  username: string;
  fileKey: string;
  videoUrl?: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  submittedAt: string;
  updatedAt: string;
}

// Part submission types for lab checkoffs
export interface PartSubmission {
  submissionId: string;
  labId: string;
  partId: string;
  studentId: string;
  userId: string;
  username: string;
  fullName?: string;
  fileKey: string;
  videoUrl?: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'dismissed';
  feedback?: string;
  submittedAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewedByName?: string;
  queuePosition?: number;
  alreadyCheckedOff?: boolean;
  checkedOffBy?: string;
  checkoffType?: string;
}

// Lab part definition
export interface LabPart {
  partId: string;
  title: string;
  description: string;
  order: number;
  requiresCheckoff: boolean;
  checkoffType: 'in-lab' | 'video' | 'none';
  points?: number;           // Points for this part
  isExtraCredit?: boolean;   // If true, not counted toward base 100%
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Student types
export interface Student {
  name: string;
  fullName?: string;
  section: string;
  hasAccount: boolean;
  progressSummary?: {
    completedLabs: number;
    totalLabs: number;
    overallProgress: number;
    labSummary: {
      labId: string;
      title: string;
      status: string;
      completed: boolean;
      grade: number | null;
    }[];
  };
}

export interface StudentDetail extends Student {
  fullName?: string;
  progress: {
    labId: string;
    title: string;
    status: 'locked' | 'unlocked';
    completed: boolean;
    grade: number | null;
    totalGrade?: number | null;
    earlyBirdPoints?: number;
    parts: {
      partId: string;
      title?: string;
      description?: string;
      completed: boolean;
      completedAt?: string;
      checkoffType: 'in-lab' | 'video' | 'pending' | 'inlab' | 'queue';
      videoUrl?: string;
      submissionId?: string;
      submissionStatus?: 'pending' | 'approved' | 'rejected';
      points?: number;
      isExtraCredit?: boolean;
      lastModifiedByName?: string | null;
    }[];
  }[];
}

export interface CheckoffUpdate {
  labId: string;
  partId?: string;
  status?: 'locked' | 'unlocked';
  completed?: boolean;
  grade?: number | null;
  checkoffType?: 'in-lab' | 'video' | 'pending' | 'inlab' | 'queue';
  submissionId?: string;
  feedback?: string;
}

// Queue types for staff review
export interface SubmissionQueue {
  items: PartSubmission[];
  totalCount: number;
  pendingCount: number;
}

// Filter options for the queue
export interface QueueFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'dismissed' | 'all';
  labId?: string;
  partId?: string;
  studentId?: string;
  sortBy?: 'submittedAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}

// Lab Queue types for real-time help/checkoff queue
export interface QueueEntry {
  entryId: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  queueType: 'checkoff' | 'help';
  labId?: string | null;
  partId?: string | null;
  joinedAt: string;
  position: number;
}

export interface LabQueue {
  checkoffQueue: QueueEntry[];
  helpQueue: QueueEntry[];
  totalCheckoff: number;
  totalHelp: number;
}

export interface LabQueueResponse {
  queue: LabQueue;
  myEntry?: QueueEntry | null;
}

export interface LabGradeEntry {
  studentName: string;
  studentFullName?: string;
  section: string;
  hasAccount: boolean;
  parts: {
    partId: string;
    title: string;
    completed: boolean;
    completedAt?: string;
    points: number;
    isExtraCredit: boolean;
    lastModifiedBy?: string | null;
    lastModifiedByName?: string | null;
  }[];
  basePointsEarned: number;
  basePointsTotal: number;
  extraCreditEarned: number;
  earlyBirdPoints: number;
  totalGrade: number;
}

// Partner system types
export interface PartnerRequest {
  requestId: string;
  fromStudentId: string;
  fromStudentName?: string;
  toStudentId: string;
  toStudentName?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

export interface Partner {
  studentId: string;
  fullName?: string;
  section?: string;
  hasAccount?: boolean;
}

export interface PartnerInfo {
  currentPartner: Partner | null;
  hasPartner: boolean;
  incomingRequests: PartnerRequest[];
  outgoingRequests: PartnerRequest[];
}

export interface SelectableStudent {
  studentId: string;
  fullName: string;
  section?: string;
  hasPartner: boolean;
}

// Staff role management (Wave 3)
export interface StaffUser {
  email: string;
  username: string | null;
  status: string; // CONFIRMED, NOT_SIGNED_UP, etc.
  enabled: boolean;
  role: UserRole;
  fullName: string | null;
  section: string | null;
  createdAt: string | null;
  lastModifiedAt: string | null;
  hasAccount: boolean;
  onAllowlist?: boolean;
  allowlistRole?: 'ta' | 'admin';
}

export interface StaffListResponse {
  count: number;
  users: StaffUser[];
  allowlists: {
    admins: string[];
    tas: string[];
  };
}

// Term management (Wave 4)
export type TermStatus = 'upcoming' | 'active' | 'archived';

export interface Term {
  termId: string;        // e.g. "sp26"
  displayName: string;   // e.g. "Spring 2026"
  status: TermStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  archivedAt?: string;
  isActive?: boolean;
}

export interface TermListResponse {
  terms: Term[];
  activeTermId: string | null;
  count: number;
}

export interface CurrentTermResponse {
  activeTermId: string | null;
  term: Term | null;
}

// Term purge / data lifecycle (Wave 5).
//
// The source of truth for these types lives in utils/purge.ts alongside the
// fetch helpers; we re-export them here so consumers can import either from
// '../types' (matching how Term/TermListResponse are imported) or directly
// from '../utils/purge'. Keep this in sync with utils/purge.ts.
export type {
  TermUsage,
  SnapshotResult,
  PurgeResult,
  OrphanedMedia,
  StudentResetResult,
} from '../utils/purge';

// Audit log (Wave 6). Same re-export pattern as purge types above —
// source of truth lives in utils/audit.ts.
export type {
  AuditEntry,
  AuditQueryParams,
  AuditListResponse,
  AuditActionsResponse,
  AuditExportResponse,
} from '../utils/audit';

