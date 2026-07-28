# Risk Register — Phase 1 Discovery Audit

| Category | Risk | Probability | Impact | Evidence | Recommended mitigation |
| --- | --- | --- | --- | --- | --- |
| Technical | Mock/demo data remains in production-facing flows | High | High | Review, report, team, and claim-rendering files import `mock-data`; overview states no production AI is connected and backend wiring remains | Gate demo mode explicitly and replace mock-backed surfaces with persisted server functions before production |
| Technical | Server functions combine validation, data access, audit logging, and external API calls without separate service/test seams | Medium | Medium | Domain logic lives directly in `src/lib/*.functions.ts`; no tests for those modules were found | Extract pure service helpers where useful and add server-function tests with Supabase mocks/local harness |
| Technical | Storage access depends on path convention | Medium | High | Storage RLS policies cast the first storage folder segment to UUID for `can_access_session` | Centralize storage path construction and add policy tests for valid/invalid paths |
| Technical | No job/queue layer for long-running transcription | Medium | Medium/High | `transcribeRecording` calls external speech-to-text synchronously from a server function and then mutates transcript tables | Move long-running AI transcription to background workflow or add timeout/retry/status handling |
| Operational | CI workflow drift | High | Medium | Main CI uses Bun/Vite typecheck/test; separate webpack workflow runs npm + `npx webpack` | Remove stale workflow or align all workflows to Vite/Bun build/test commands |
| Operational | Deployment process is ambiguous | Medium | High | Cloudflare Worker config exists, but GitHub Pages Jekyll deployment also exists | Document the authoritative deployment target and rollback process; disable stale deployment workflow |
| Operational | No monitoring/alerting implementation found | Medium | Medium | No telemetry/monitoring config found; project overview recommends adding monitoring | Add runtime error monitoring/log aggregation and AI permission-denial alerts before production |
| Security | Route-level auth has a client-side `beforeLoad` gate in addition to server checks; future loaders could accidentally skip server guard | Medium | High | `_authenticated` uses `ssr:false` and `supabase.auth.getUser()` client-side; protected loaders must call `requireSession`/`guardRouteAccess` separately | Keep lint/test coverage ensuring every protected loader calls a server guard |
| Security | Demo case visibility intentionally exposes seeded data to all authenticated users | Medium | Medium | RLS policies allow `is_demo` cases/sessions to be selected by authenticated users | Ensure demo data contains no real client/court material and disable demo seeds in production |
| Security | Required secrets are not centrally documented in `.env.example` | High | Medium | `.env` exists but no `.env.example` was found in inventory; code requires Supabase variables and `LOVABLE_API_KEY` for transcription | Add `.env.example` with non-secret names and deployment secret checklist |
| Security | Password sign-up form lacks explicit app-level password policy messaging | Medium | Medium | Auth route accepts password field and delegates to Supabase; no UI copy found describing minimums/MFA | Document/enforce Supabase auth settings and add user-facing password/MFA guidance if required |

## Detailed findings

Finding:
The largest current production-readiness risk is mixed real persistence with mock/demo product flows.

Evidence:
Supabase-backed server functions exist for cases, sessions, evidence, recordings, and transcripts, while review/report/team claim flows still import `mock-data`; `PROJECT_OVERVIEW.md` describes the app as a frontend prototype and lists backend work remaining before deployment.

Files:
`src/lib/*.functions.ts`, `src/routes/_authenticated.review.tsx`, `src/routes/_authenticated.sessions.$sessionId.report.tsx`, `src/routes/_authenticated.team.tsx`, `PROJECT_OVERVIEW.md`

Confidence:
High

Finding:
CI/CD state is operationally inconsistent.

Evidence:
One workflow runs Bun install, typecheck, and tests; another invokes webpack with npm; another deploys Jekyll Pages from repo root despite the app being Vite/TanStack/Cloudflare configured.

Files:
`.github/workflows/ci.yml`, `.github/workflows/webpack.yml`, `.github/workflows/jekyll-gh-pages.yml`, `wrangler.jsonc`, `vite.config.ts`

Confidence:
High
