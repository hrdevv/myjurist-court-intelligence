## Goal

Three deliverables: (1) close the `csa_authenticated_layout` security finding with real server-side enforcement, (2) add an in‑app `/handoff` Phase‑5 summary page, (3) produce a complete app overview document.

---

## 1. Fix the browser-only auth gate (security finding)

**Constraint that shapes the fix:** The Lovable Supabase integration *owns* `src/routes/_authenticated/route.tsx`. Its `ssr: false` + client-side `supabase.auth.getUser()` redirect is the canonical, required pattern (Supabase stores the session in `localStorage`, which the server can't read). Rewriting it to `ssr: true` / cookie-based checks would break hard-refresh and cause redirect loops, so the scanner's remediation **option 1 is rejected**. We implement **option 2: server-side enforcement on every authenticated loader**, which is the platform-correct fix.

Steps:
- **Add a reusable server guard.** In `src/lib/route-guards.ts`, add `requireSession()` that calls a new lightweight server fn `requireAuthenticated` (in `src/lib/permissions.functions.ts`, using `requireSupabaseAuth` middleware) returning `{ userId }`. This forces a real, server-validated bearer-token check for the route — independent of the browser-only layout gate.
- **Wire it into every authenticated loader that currently has none:**
  - `_authenticated.index.tsx` (dashboard)
  - `_authenticated.cases.index.tsx`
  - `_authenticated.cases.$caseId.tsx`
  - `_authenticated.reports.tsx`
  - `_authenticated.sessions.$sessionId.index.tsx`
  - `_authenticated.sessions.$sessionId.report.tsx`
  - `_authenticated.sessions.$sessionId.review.tsx`
  
  Each loader becomes `async`, calls `await requireSession()` first, then keeps its existing mock/notFound logic. Routes already using `guardRouteAccess` (review, team, audit) are unchanged — that guard already runs a `requireSupabaseAuth` server fn.
- Ensure each newly-async loader route has `errorComponent` (most already do); add where missing so an SSR/auth failure can't blank the app.
- **Mark the finding resolved.** Use `manage_security_finding` → `mark_as_fixed` on `csa_authenticated_layout` (scanner `agent_security`) explaining server-side enforcement now backs every authenticated loader, and update `@security-memory` to record that the `ssr:false` managed layout is intentional and that authenticated data access is enforced server-side via `requireSupabaseAuth`.

## 2. `/handoff` page — Phase 5 handoff summary

- New public-but-app route `src/routes/_authenticated.handoff.tsx` (kept inside the authenticated area, consistent with the rest of the workspace) with proper `head()` title/description.
- Renders, sourced from spec `06_BACKEND_HANDOFF_NOTES.md` and `05` Phase 5:
  - **Screens built** — table of every implemented route/screen.
  - **Mock data used** — case `LDH-2026-001`, 5 users, 5 transcript segments, 3 evidence files, 4 AI claims.
  - **Backend assumptions** — Laravel 11, MySQL, role policies, tenant scoping, private evidence storage, checksums, transcript versioning, Gemini service, AI_MODE, anchor verifier, audit logs.
  - **Components needing Laravel wiring.**
  - **Required API endpoints** — the 13 routes from `06` rendered as a table.
  - **Production warnings** — disclaimers, evidence privacy, no real storage, demo AI mode.
- Add a "Handoff" nav item to `src/components/layout/Sidebar.tsx`.

## 3. App overview document

- Create `PROJECT_OVERVIEW.md` at repo root covering: product purpose, primary users/roles, end-to-end workflow, feature list per screen, AI-assisted features (draft claims, evidence anchoring, confidence/anchor badges — demo mode), access-control model (RBAC via `user_roles` + RLS + server guards), what's done, what remains before production deployment (real backend, storage, live AI, audit persistence, Search Console), and recommendations.
- Surface the same overview in-app as a section/link on the `/handoff` page so non-technical users can read it without opening the repo.

---

### Technical notes
- `requireAuthenticated` must NOT be called from a public-route loader; all target loaders live under `_authenticated/`, so SSR prerender uses the managed gate — safe.
- Loaders stay isomorphic-safe: only the server fn touches Supabase; mock data logic is unchanged.
- No schema/migration changes required.

### Validation
- `bun run typecheck` and `bun run test` (existing guard unit + e2e tests must still pass).
- Drive the preview with Playwright (authenticated session) to confirm `/handoff` renders and guarded routes still load for allowed roles.