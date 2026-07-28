# Next Actions — Evidence-Backed Recommendations

## Immediate next action

**Do this first:** hard-gate all mock/demo-backed legal outputs behind an explicit demo-mode boundary before any production deployment or broader feature work.

Problem: The audit found that the app already has real Supabase-backed persistence for several domains, but review/report/team legal-output surfaces still consume mock/demo data. That mix creates the highest immediate risk because a user could interpret demo AI claims, team data, or report content as live case material.

Evidence: `src/routes/_authenticated.review.tsx`, `src/routes/_authenticated.sessions.$sessionId.report.tsx`, and `src/routes/_authenticated.team.tsx` import `src/lib/mock-data.ts`; `PROJECT_OVERVIEW.md` states that no production AI is connected and that backend wiring remains before deployment.

Impact: Prevents accidental production exposure or reliance on non-persisted demo legal intelligence while preserving the prototype for demos and follow-on engineering.

Effort: Low/Medium for an explicit gate and environment documentation; High for full replacement with persisted claims/review/report APIs.

Priority: Critical.

Suggested Action: Add an environment-controlled demo-mode gate, visible runtime banner, and deployment checklist that blocks production configuration when mock-backed routes are enabled; then implement persisted claims/review/report APIs as the next engineering milestone.

## Critical

### Replace or hard-gate mock/demo review and report flows

Problem: Production-facing review/report/team surfaces still depend on mock data while other domains already use Supabase.

Evidence: `src/routes/_authenticated.review.tsx`, `src/routes/_authenticated.sessions.$sessionId.report.tsx`, and `src/routes/_authenticated.team.tsx` import `src/lib/mock-data.ts`; `PROJECT_OVERVIEW.md` says production backend and live AI remain out of scope for the prototype.

Impact: Users could mistake demo AI claims, team data, or report content for persisted legal records.

Effort: High.

Priority: Critical.

Suggested Action: Add explicit environment-controlled demo mode and implement persisted claims/review/report APIs before enabling production usage.

## High

### Align CI/CD workflows to the actual Vite/TanStack/Cloudflare app

Problem: Workflows disagree about build tooling and deployment target.

Evidence: Main CI uses Bun and runs typecheck/test; webpack workflow uses npm and `npx webpack`; Jekyll workflow deploys Pages; app config uses Vite and Cloudflare Worker settings.

Impact: Pull requests may fail for irrelevant reasons or deploy the wrong artifact.

Effort: Medium.

Priority: High.

Suggested Action: Keep one authoritative CI pipeline running install, lint, typecheck, test, and `bun run build`; disable stale webpack/Jekyll workflows unless intentionally used.

### Add tests for server functions and RLS/storage access

Problem: Existing tests cover route guards but not data mutation, signed URL authorization, transcription side effects, or RLS policies.

Evidence: Only `src/lib/route-guards.test.ts` and `src/lib/guarded-routes.e2e.test.tsx` were found; migrations contain substantial RLS/storage policy logic.

Impact: Regressions in case/session/evidence/transcript access may not be caught before deployment.

Effort: Medium/High.

Priority: High.

Suggested Action: Add server-function unit/integration tests plus Supabase local policy tests for owner/member/demo/unauthorized scenarios.

### Document required runtime environment and secrets

Problem: Required environment variables are enforced in code, but no `.env.example` was found.

Evidence: Supabase client/middleware throw when URL/key variables are missing; transcription function requires `LOVABLE_API_KEY`; inventory found `.env` but no `.env.example`.

Impact: New environments can fail at runtime or mishandle secrets.

Effort: Low.

Priority: High.

Suggested Action: Add `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `LOVABLE_API_KEY`, plus notes that values must be provisioned as secrets.

## Medium

### Move AI transcription toward asynchronous processing

Problem: Transcription is executed synchronously inside a server function.

Evidence: `transcribeRecording` obtains a signed recording URL, calls an external speech-to-text endpoint, deletes/reinserts transcript segments, writes versions, and updates recording status.

Impact: Long recordings or external API delays can cause request timeouts and partial operational uncertainty.

Effort: High.

Priority: Medium.

Suggested Action: Introduce queued/background transcription with durable status transitions, retries, and idempotency.

### Centralize and validate storage path construction

Problem: Storage RLS policies assume the first path segment is a session UUID.

Evidence: Migrations call `public.can_access_session(((storage.foldername(name))[1])::uuid)` for evidence and recordings storage policies.

Impact: Incorrect paths can break access or create unexpected policy behavior.

Effort: Medium.

Priority: Medium.

Suggested Action: Create a single storage path helper, validate paths before insert/upload, and test policy behavior for malformed paths.

### Add coverage thresholds and UI workflow tests

Problem: Test coverage breadth is currently narrow and no coverage thresholds exist.

Evidence: Vitest includes test files but no coverage configuration; discovered tests target route guards only.

Impact: UI regressions in legal workflows may pass CI.

Effort: Medium.

Priority: Medium.

Suggested Action: Add Vitest coverage settings and component/browser tests for auth, create case/session, evidence/recording panels, transcript editing, review queue, and report preview.

## Low

### Clarify package manager/runtime policy

Problem: Bun and npm lockfiles both exist, and Node versions differ across workflows.

Evidence: `bun.lock`, `package-lock.json`, Bun CI, and npm webpack workflow are all present; `package.json` has no `engines` field.

Impact: Dependency resolution and local onboarding can drift.

Effort: Low.

Priority: Low.

Suggested Action: Choose/document the supported package manager and Node version, then remove stale lock/workflow artifacts if not needed.

### Add an architecture decision record for Supabase/TanStack Start prototype boundaries

Problem: The repository contains both real Supabase persistence and explicit prototype/demo boundaries.

Evidence: Server functions and migrations implement real tables/RLS; project overview says Laravel production backend remains out of scope.

Impact: Future contributors may not know whether to extend the prototype backend or wait for the production backend.

Effort: Low.

Priority: Low.

Suggested Action: Add an ADR explaining current architecture, what is prototype-only, and the intended migration path.
