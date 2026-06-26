# Courtroom Intelligence — Project Overview

**Version:** v1.2 (frontend prototype) · **Stack:** TanStack Start (React 19) + Tailwind v4 + Lovable Cloud (auth)

---

## 1. What this app is

Courtroom Intelligence is a **legal-session intelligence workspace** that helps
litigation teams preserve, structure, and review courtroom or legal-session
materials. It centers on **cases, sessions, evidence, transcripts, AI-assisted
draft claims, human review, and reports** — it is deliberately **not** a generic
"ask AI anything" chatbot.

Its core promise: *structured courtroom intelligence grounded in verified
evidence, with every AI output checked by a human before it reaches a report.*

## 2. Who it's for

| Role | Responsibility |
| --- | --- |
| Paralegal / Legal Assistant | Daily operator — opens cases/sessions, uploads evidence, pastes transcripts, generates draft claims |
| Lawyer | Final reviewer and report approver |
| Reviewer | Assigned claim reviewer |
| Admin | Organization / user management |
| Viewer | Read-only access |

## 3. Primary workflow

```text
Paralegal opens a case
  → opens a session
  → reviews the transcript
  → sees AI-assisted draft claims
  → verifies the evidence anchor
  → lawyer/reviewer approves or rejects
  → approved claims appear in the report preview
```

## 4. Features by screen

- **Dashboard** — active cases, sessions pending review, unsupported claims,
  reports ready, recent activity, quick CTAs (Create Case, Open Review Queue).
- **Cases Index** — title, reference, court, status, pending-review count, last activity.
- **Case Detail** — tabbed view (Overview, Sessions, Evidence, Reports, Team, Audit).
- **Session Detail** — workspace with transcript panel, evidence list, AI claim
  summary, review progress, and demo actions (Upload Evidence, Paste Transcript,
  Generate Review Draft, Open Review Console, Preview Report).
- **Evidence Upload Panel** — file type selector, dropzone, description, demo
  upload status, checksum placeholder, private-storage notice.
- **Transcript Viewer / Editor** — timestamp, speaker, text, confidence badge,
  edit control, version-history indicator.
- **AI Claims List** — claim cards with type, text, confidence, support status,
  review status, evidence-anchor count.
- **Review Queue** — filters (pending, unsupported, low confidence, possible
  inconsistency candidates, approved, rejected).
- **Review Detail** — side-by-side: source on the left; AI claim, anchor status,
  confidence, and review controls on the right (Approve for Report, Reject, Edit
  and Approve, Mark Uncertain, Needs More Evidence) plus a reviewer note box.
- **Report Preview** — visible legal disclaimer, approved summary points,
  evidence references, possible inconsistency candidates, unresolved issues,
  reviewer notes, and an excluded-claims section. Unsupported/rejected claims
  are never in the main report.
- **Handoff (`/handoff`)** — Phase 5 summary for the backend team.

## 5. AI features (demo mode)

- **Generate Review Draft** — produces draft claims from the transcript. Always
  labelled a *draft*, never "legal advice".
- **Evidence anchoring** — each claim links to transcript/evidence segments with
  an anchor status (verified / suggested / failed / manual / none).
- **Confidence levels** — high / medium / low / unsupported, surfaced as badges.
- **Cautious language** — "possible inconsistency candidate", never "contradiction".
- **Demo AI Mode banner** — persistent reminder that no production AI is connected.

> All AI output is advisory. Nothing reaches a report without explicit human review.

## 6. Access-control model

- Auth via Lovable Cloud (email/password + Google).
- Roles stored in a dedicated `user_roles` table (enum: lawyer, paralegal,
  reviewer, viewer) with RLS and a `has_role` security-definer function — never
  on the profile/users table.
- Authenticated routes live under the `/_authenticated` layout.
- **Server-side enforcement:** every authenticated loader calls a
  server-validated guard — `requireSession()` for general authenticated pages,
  and `guardRouteAccess()` for role-gated areas (Review, Team, Audit). Both run
  through `requireSupabaseAuth`, so authorization is decided on the server using
  the validated bearer token, not trusted to the browser.
- Unauthorized access redirects to `/unauthorized`, which explains the required
  vs. current roles, and logs the denial server-side for troubleshooting.

## 7. What has been done

- Full UI for specs 00–04, 07, 08 (all screens above).
- RBAC with server-side route guards and audit logging of denials.
- Authentication (email/password + Google OAuth via the Lovable broker).
- SEO/accessibility: robots.txt, llms.txt, sitemap, semantic landmarks, meta tags.
- CI typecheck + tests; unit + e2e tests for the route guards.
- Phase 5 handoff page (`/handoff`) and this overview.

## 8. What remains before deployment (out of scope for this prototype)

The production backend (spec 06) is intentionally **not** built here. Before
go-live, the Laravel/Codex team must:

1. Build the Laravel 11 + React/Inertia backend with MySQL migrations.
2. Implement private evidence storage, file checksums, and transcript versioning.
3. Wire the Gemini API service with `AI_MODE` (disabled / demo / live) and the
   evidence anchor verifier.
4. Implement review decisions, report inclusion rules, and audit logs.
5. Enforce role policies and tenant scoping server-side, mirroring the demo RBAC.
6. Replace all mock data with real API calls (endpoints listed on `/handoff`).
7. Produce the cPanel deployment package.

## 9. Recommendations

- Keep the legal disclaimer and Demo/AI-mode messaging until production AI and
  storage are verified.
- Treat evidence as private by default; never expose files via public buckets.
- Preserve the "human-in-the-loop" gating — AI claims must stay drafts until reviewed.
- Carry the server-side authorization model into Laravel policies so the security
  posture is consistent across the prototype and production.
- Add monitoring/alerting on the AI service and on permission-denial logs.
- Verify the production build and run the full test suite in CI on every change.
