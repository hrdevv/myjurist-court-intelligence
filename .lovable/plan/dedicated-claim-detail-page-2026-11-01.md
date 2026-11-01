# Dedicated claim detail page

Replace the right-hand claim panel on the session review page with a full page per claim.

## What the user gets
- New page: `/sessions/<session>/claims/<claim>` showing:
  - Claim header: type, confidence, review status, text, warning, latest reviewer note.
  - **Anchors**: each anchor with status (verified / manual / none), matched quote and match score.
  - **Transcript**: the session transcript with anchored segments highlighted and scrolled into view; nearby context shown.
  - **Evidence**: the session's evidence files with download (uses the existing 60s signed links).
  - **Review history**: every past review decision for this claim (who, when, decision, note) from the audit trail, newest first.
  - **Submit review**: Approve / Reject / Uncertain / Needs more evidence + note, reviewers only; on save the status and history refresh.
- Session review page: the right-hand panel is removed; the claim list takes the full width, and each claim links to its detail page. Session detail page "Open in Review Console" links on claim cards go to the claim page instead.
- Loading, not-found ("Claim not found") and retryable error states.

## Technical details
- Route file `src/routes/_authenticated.sessions.$sessionId.claims.$claimId.tsx` with loader (`requireSession`, then data via React Query `ensureQueryData` + `useSuspenseQuery`), `head()`, `errorComponent`, `notFoundComponent`.
- New server fn `getClaimDetail({ sessionId, claimId })` in `src/lib/claims.functions.ts` (requireSupabaseAuth + `requireReviewRole`): returns claim, anchor rows (quote, match_score), and review history from `audit_logs` where `action = 'claim.reviewed'` and `detail->>claim_id = claimId`, joined to profile display names. Throws notFound when claim missing or not in session.
- Also record `reviewer_note` in the audit `detail` in `updateClaimReview` so history shows notes.
- Reuse `listTranscript`, `listEvidence`, `resolveAnchoredSegments`, existing badges, `updateClaimReview`.
- Verify an audit_logs SELECT policy lets reviewers read case logs; add a migration only if missing.
- Add a test asserting history filtering to the given claim only.
- Verify in preview: open a claim, submit a review, see it appear in history.
