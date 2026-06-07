export type AnchorStatus =
  | "verified"
  | "suggested"
  | "failed"
  | "none"
  | "manual";

export type ConfidenceLevel = "high" | "medium" | "low" | "unsupported";

export type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "uncertain"
  | "needs_more_evidence";

export type ClaimType =
  | "key_statement"
  | "inconsistency_candidate"
  | "unsupported_inference"
  | "follow_up";

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  confidence: "high" | "medium" | "low";
  version: number;
}

export interface EvidenceFile {
  id: string;
  name: string;
  type: "audio" | "document" | "image" | "video";
  size: string;
  uploadedAt: string;
  checksum: string;
  status: "demo_uploaded";
}

export interface ClaimAnchor {
  segmentId: string;
  status: AnchorStatus;
}

export interface AIClaim {
  id: string;
  type: ClaimType;
  text: string;
  confidence: ConfidenceLevel;
  support: "supported" | "partially_supported" | "unsupported";
  anchors: ClaimAnchor[];
  review: ReviewStatus;
  reviewerNote?: string;
  warning?: string;
}

export interface Session {
  id: string;
  caseId: string;
  title: string;
  date: string;
  status: "review_pending" | "in_review" | "report_ready" | "draft";
  transcript: TranscriptSegment[];
  evidence: EvidenceFile[];
  claims: AIClaim[];
}

export interface Case {
  id: string;
  title: string;
  reference: string;
  court: string;
  status: "active" | "closed" | "archived";
  pendingReview: number;
  lastActivity: string;
  team: { name: string; role: string; email: string }[];
}

export const mockUsers = [
  { name: "Admin User", email: "admin@example.com", role: "Admin" },
  { name: "Lawyer User", email: "lawyer@example.com", role: "Lawyer" },
  { name: "Paralegal User", email: "paralegal@example.com", role: "Paralegal" },
  { name: "Reviewer User", email: "reviewer@example.com", role: "Reviewer" },
  { name: "Viewer User", email: "viewer@example.com", role: "Viewer" },
];

export const transcript: TranscriptSegment[] = [
  { id: "t1", timestamp: "01:42:11", speaker: "Witness", text: "I never entered the building.", confidence: "high", version: 2 },
  { id: "t2", timestamp: "01:58:03", speaker: "Counsel", text: "Did you speak to the caretaker that day?", confidence: "high", version: 1 },
  { id: "t3", timestamp: "01:58:09", speaker: "Witness", text: "No, I did not speak to anyone there.", confidence: "high", version: 1 },
  { id: "t4", timestamp: "02:05:18", speaker: "Witness", text: "I entered briefly to speak with the caretaker.", confidence: "medium", version: 1 },
  { id: "t5", timestamp: "02:15:44", speaker: "Judge", text: "The answer will remain on record.", confidence: "high", version: 1 },
];

export const evidence: EvidenceFile[] = [
  { id: "e1", name: "hearing-recording-2026-05-22.mp3", type: "audio", size: "48.2 MB", uploadedAt: "2026-05-22", checksum: "sha256:9f2a…b71c", status: "demo_uploaded" },
  { id: "e2", name: "site-photo-front-gate.jpg", type: "image", size: "2.1 MB", uploadedAt: "2026-05-22", checksum: "sha256:11de…ac08", status: "demo_uploaded" },
  { id: "e3", name: "caretaker-statement.pdf", type: "document", size: "312 KB", uploadedAt: "2026-05-21", checksum: "sha256:7c3b…f9aa", status: "demo_uploaded" },
];

export const claims: AIClaim[] = [
  {
    id: "c1",
    type: "key_statement",
    text: "The witness stated they never entered the building.",
    confidence: "high",
    support: "supported",
    anchors: [{ segmentId: "t1", status: "verified" }],
    review: "approved",
  },
  {
    id: "c2",
    type: "inconsistency_candidate",
    text: "The witness later stated they entered briefly after earlier denying entry.",
    confidence: "medium",
    support: "partially_supported",
    anchors: [
      { segmentId: "t1", status: "verified" },
      { segmentId: "t4", status: "suggested" },
    ],
    review: "pending",
  },
  {
    id: "c3",
    type: "unsupported_inference",
    text: "The witness intentionally misled the court.",
    confidence: "unsupported",
    support: "unsupported",
    anchors: [],
    review: "rejected",
    warning: "This wording is unsafe and must be excluded from the report.",
  },
  {
    id: "c4",
    type: "follow_up",
    text: "Ask the witness to clarify whether they spoke with the caretaker.",
    confidence: "medium",
    support: "supported",
    anchors: [
      { segmentId: "t3", status: "verified" },
      { segmentId: "t4", status: "suggested" },
    ],
    review: "needs_more_evidence",
  },
];

export const sessions: Session[] = [
  {
    id: "s1",
    caseId: "case1",
    title: "Preliminary Hearing — Demo Session",
    date: "2026-05-22",
    status: "review_pending",
    transcript,
    evidence,
    claims,
  },
];

export const cases: Case[] = [
  {
    id: "case1",
    title: "Land Dispute Hearing Demo",
    reference: "LDH-2026-001",
    court: "Federal High Court",
    status: "active",
    pendingReview: 2,
    lastActivity: "2026-05-22",
    team: mockUsers.slice(0, 4).map(u => ({ name: u.name, role: u.role, email: u.email })),
  },
];

export const recentActivity = [
  { id: "a1", who: "Paralegal User", what: "uploaded transcript segment", when: "2 hours ago", case: "LDH-2026-001" },
  { id: "a2", who: "Reviewer User", what: "approved a key statement", when: "3 hours ago", case: "LDH-2026-001" },
  { id: "a3", who: "Lawyer User", what: "rejected an unsupported inference", when: "yesterday", case: "LDH-2026-001" },
  { id: "a4", who: "Paralegal User", what: "opened Preliminary Hearing session", when: "yesterday", case: "LDH-2026-001" },
];

export const dashboardMetrics = {
  activeCases: 1,
  sessionsPendingReview: 1,
  unsupportedClaims: 1,
  reportsReady: 0,
};

export const LEGAL_DISCLAIMER =
  "This report may include AI-assisted draft analysis. All legal conclusions require human professional review. Evidence references should be independently verified before use.";

export function getCase(id: string) { return cases.find(c => c.id === id); }
export function getSession(id: string) { return sessions.find(s => s.id === id); }
export function getSegment(id: string) { return transcript.find(t => t.id === id); }
