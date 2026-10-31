# Seed demo data + working review submission

## Goal

1. Cases and Review Queue show real rows: a few cases, sessions, transcripts, evidence, and claims with anchors.
2. Review submission on the session review page works end to end and the updated status shows immediately on the claim's detail panel.

## What already exists (verified this turn)

- The session review page already wires Approve / Uncertain / Needs More Evidence / Reject to `updateClaimReview`, which saves `review_status`, `reviewer_note`, `reviewed_by`, `reviewed_at` and writes an audit log. The selected-claim panel already shows the review badge and reviewer note.
- There is no dedicated claim detail page; the panel is the claim detail. User chose: refresh the existing panel, no new page.
- Review actions require a lawyer / paralegal / reviewer role (`requireReviewRole`), so seeded data must include a role row for the signed-in user or every action returns 403.
- Cloud backend was degraded during planning, so the database could not be inspected yet. Step 1 re-checks.

## Plan

### 1. Verify backend and inspect current data

- Poll `supabase--cloud_status` until `ACTIVE_HEALTHY`.
- Read current rows (`cases`, `sessions`, `claims`, `claim_anchors`, `user_roles`, `auth.users`) to avoid duplicates and find the signed-in user's id.

### 2. Seed data (data changes via the SQL data tool, not a migration)

Reuse the existing land-dispute demo scenario and extend it:

- 3 cases marked `is_demo = true` (visible to everyone by the SELECT policy), e.g. the Land Dispute Hearing plus two more court cases, each with a `case_members` row.
- 3–4 sessions across those cases; two sessions carry content:
  - `transcript_segments` (witness/counsel exchanges, including the contradiction pair used by the demo claims),
  - `evidence` rows (recording, photo, statement PDF),
  - 5–8 `claims` with realistic text — mostly `review_status = 'pending'` so the Review Queue is populated, plus one rejected/one approved to show decided states, one with a `warning` for an unsupported inference,
  - matching `claim_anchors` (verified/suggested) pointing at the transcript segments.
- A `user_roles` row (`lawyer`) for the signed-in user so review actions pass the role check.
- A few `audit_logs` entries so the audit page reflects the seeded activity.

Constraints to respect:

- The `guard_is_demo` trigger blocks non-service-role writes to `is_demo`. If the seed insert with `is_demo = true` is refused, fall back to `is_demo = false` plus `case_members` rows for the signed-in user so the rows are still visible to them.
- If the backend stays degraded or paused, stop seeding and report the blocker instead of working around it.

### 3. Review submission end to end

- Trace the existing flow and fix whatever blocks it: most likely the missing role row (fixed by seeding) or an error in `updateClaimReview`; nothing else should change unless the trace shows a real fault.
- Confirm the review console refreshes after saving (`router.invalidate()` reloads loader data) so the panel shows the new status and reviewer note immediately.
- Check the Review Queue page also reflects the updated statuses.

### 4. Verification

- Run typecheck and build.
- In the preview, signed in: Cases page lists the seeded cases → open a case → open its session review console → approve a claim → confirm the status badge and reviewer note update in the panel and persist after reload.
- Run the project's existing tests (`bunx vitest run`).

## Technical notes

- Seeding uses the data SQL tool (INSERT statements) because schema already exists; no schema migration is expected.
- `listClaimsBySession` has no role check by design (login only); only submission is reviewer-gated.
