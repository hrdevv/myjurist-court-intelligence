# System Map — Phase 1 Discovery Audit

## Evidence protocol

Each conclusion below is based on repository inspection only. Findings use the required `Finding / Evidence / Files / Confidence` format where a discrete architectural conclusion is made.

## Repository Tree

```text
.
├── .github/workflows/          # GitHub Actions CI/deployment workflows
├── .lovable/                   # Lovable project metadata
├── public/                     # robots.txt and llms.txt public assets
├── src/
│   ├── components/             # UI, layout, case/session/legal components
│   ├── hooks/                  # React hooks including auth state
│   ├── integrations/           # Lovable and Supabase clients/middleware/types
│   ├── lib/                    # server functions, guards, mock/demo content, utilities, tests
│   ├── routes/                 # TanStack Router file routes
│   ├── router.tsx              # router factory and QueryClient wiring
│   ├── routeTree.gen.ts        # generated route tree
│   ├── server.ts               # Cloudflare/TanStack Start SSR wrapper
│   ├── start.ts                # TanStack Start middleware registration
│   └── styles.css              # Tailwind/theme styles
├── supabase/
│   ├── config.toml             # Supabase project config
│   └── migrations/             # PostgreSQL schema, RLS, policies, seeds
├── package.json                # scripts and JS dependency manifest
├── vite.config.ts              # Lovable/TanStack/Vite build config
├── vitest.config.ts            # test runner config
├── wrangler.jsonc              # Cloudflare Workers runtime config
├── tsconfig.json               # TypeScript compiler config
└── PROJECT_OVERVIEW.md         # product/workflow overview and handoff notes
```

## Application Inventory

| Application | Type | Purpose | Primary files | Confidence |
| --- | --- | --- | --- | --- |
| myJurist Court Intelligence | TanStack Start React app | Legal-session workspace for cases, sessions, evidence, transcripts, review queues, reports, and handoff documentation | `src/routes/*`, `src/components/*`, `src/lib/*.functions.ts`, `PROJECT_OVERVIEW.md` | High |
| Supabase backend schema | Managed Postgres/Auth/Storage backend definition | Auth profiles/roles, case/session/evidence/transcript/recording tables, RLS policies, demo seed data | `supabase/migrations/*.sql`, `src/integrations/supabase/*` | High |
| Cloudflare Worker SSR host | Deployment/runtime wrapper | Runs TanStack Start server entry and normalizes catastrophic SSR failures to a branded error page | `src/server.ts`, `wrangler.jsonc`, `vite.config.ts` | High |

## Component Inventory

| Folder/component | Responsibility | Evidence files |
| --- | --- | --- |
| `src/routes` | File-based routes for auth, authenticated layout, dashboard, cases, sessions, review, reports, team, audit, unauthorized, handoff, sitemap | `src/routes/*.tsx`, `src/routes/_authenticated/route.tsx` |
| `src/lib/*.functions.ts` | TanStack Start server functions for cases, sessions, evidence, recordings, transcripts, permissions | `src/lib/cases.functions.ts`, `src/lib/sessions.functions.ts`, `src/lib/evidence.functions.ts`, `src/lib/recordings.functions.ts`, `src/lib/transcript.functions.ts`, `src/lib/permissions.functions.ts` |
| `src/integrations/supabase` | Supabase browser client, bearer-token attaching middleware, server auth middleware, generated database types | `src/integrations/supabase/client.ts`, `src/integrations/supabase/auth-attacher.ts`, `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/types.ts` |
| `src/hooks` | Auth/session/role state and mobile helper | `src/hooks/use-auth.tsx`, `src/hooks/use-mobile.tsx` |
| `src/components/ui` | shadcn/Radix-style reusable primitives | `src/components/ui/*.tsx`, `components.json` |
| `src/components/layout` | App chrome, sidebar, prototype banner | `src/components/layout/AppLayout.tsx`, `src/components/layout/Sidebar.tsx` |
| `src/components/sessions` | Evidence, recording, transcript, audio player panels | `src/components/sessions/*.tsx` |
| `supabase/migrations` | Database schema, RLS, helper functions, storage policies, demo seeds | `supabase/migrations/*.sql` |
| `.github/workflows` | CI/build/deployment workflows | `.github/workflows/ci.yml`, `.github/workflows/jekyll-gh-pages.yml`, `.github/workflows/webpack.yml` |

## Architecture Overview

### Frontend Systems

| Frontend Name | Framework | Purpose | Dependencies | Risk Level |
| --- | --- | --- | --- | --- |
| Court Intelligence SPA/SSR app | React 19 with TanStack Router/Start and Vite | Authenticated legal workspace UI | `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/react-query`, `@supabase/supabase-js`, Radix UI, Tailwind v4 | Medium: some screens still read mock data while core persistence uses Supabase |

Finding:
Frontend uses TanStack Start with React and Vite.

Evidence:
`package.json` lists React, TanStack Router/Start, Vite scripts, and Vite dependencies; `vite.config.ts` imports `@lovable.dev/vite-tanstack-config`.

Files:
`package.json`, `vite.config.ts`

Confidence:
High

Finding:
Routing is file-based TanStack Router.

Evidence:
Route files call `createFileRoute(...)`; `src/router.tsx` creates the router from `routeTree`.

Files:
`src/routes/*.tsx`, `src/routes/_authenticated/route.tsx`, `src/router.tsx`

Confidence:
High

Finding:
Client-side state management is light React state/context plus TanStack Query context; no Redux/Zustand/Jotai dependency is present.

Evidence:
`AuthProvider` stores session and roles in React state/context; `src/router.tsx` creates a `QueryClient`; dependency manifest includes TanStack Query but no common global-store library.

Files:
`src/hooks/use-auth.tsx`, `src/router.tsx`, `package.json`

Confidence:
High

Finding:
Authentication is Supabase email/password plus Lovable-brokered Google OAuth, with bearer tokens attached to server-function calls.

Evidence:
The auth route calls `supabase.auth.signInWithPassword`, `supabase.auth.signUp`, and `lovable.auth.signInWithOAuth("google")`; `attachSupabaseAuth` adds `Authorization: Bearer <token>` headers for server functions.

Files:
`src/routes/auth.tsx`, `src/integrations/supabase/auth-attacher.ts`, `src/start.ts`

Confidence:
High

Finding:
API communication is through TanStack Start server functions backed by Supabase queries/storage calls.

Evidence:
Server functions are declared with `createServerFn`, protected by `requireSupabaseAuth`, and use `supabase.from(...)` / `supabase.storage.from(...)`.

Files:
`src/lib/*.functions.ts`, `src/integrations/supabase/auth-middleware.ts`

Confidence:
High

### Backend Component Map

| Backend component | Framework/runtime | Entry points | Controllers | Services | Middleware | Policies | Jobs/events/queues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TanStack Start server functions | TanStack Start on Cloudflare Worker | `src/server.ts`, `src/start.ts`, `src/lib/*.functions.ts` | No controller layer found; functions are exported per domain | Function modules for cases/sessions/evidence/recordings/transcripts/permissions | `attachSupabaseAuth`, `requireSupabaseAuth`, `errorMiddleware` | Route guards in `src/lib/route-guards.ts`; Supabase RLS in migrations | No job/event/queue implementation found |
| Supabase backend | Supabase Postgres/Auth/Storage | SQL migrations and Supabase client calls | N/A | Database functions `has_role`, `is_case_member`, `can_access_session`; storage signed URLs | RLS policies | Table/storage policies in migrations | No queue definitions found |

Finding:
No Laravel, Express, Nest, Rails, or traditional controller backend exists in the repo.

Evidence:
The only backend code found is TanStack Start server functions and Supabase migrations; route/API logic lives in `src/lib/*.functions.ts` rather than controller folders.

Files:
`src/lib/*.functions.ts`, `src/server.ts`, `supabase/migrations/*.sql`

Confidence:
High

## System Data Flow Map

### General authenticated page load

```text
User navigates to /_authenticated/... route
→ TanStack route beforeLoad checks supabase.auth.getUser() client-side
→ route loader calls requireSession() or guardRouteAccess()
→ attachSupabaseAuth adds current Supabase access token to server-function request
→ requireSupabaseAuth validates bearer token with Supabase getClaims()
→ server function queries Supabase tables under caller-scoped RLS
→ data returns to route component for rendering
```

### Case creation

```text
User submits CreateCaseDialog
→ route/component calls createCase server function
→ requireSupabaseAuth validates bearer token
→ createCase inserts into public.cases with created_by=userId
→ createCase inserts creator membership into public.case_members
→ createCase inserts audit_logs row
→ Supabase RLS enforces owner/member access
→ created case is returned to UI
```

### Evidence/recording access

```text
User opens evidence/recording panel
→ component calls listEvidence/listRecordings
→ authenticated server function queries metadata table
→ signed URL request checks row ownership via RLS
→ Supabase Storage signed URL is generated for private bucket path
→ UI can read object through signed URL
```

### AI transcription flow

```text
User clicks Transcribe with AI
→ transcribeRecording server function validates auth
→ function reads recording metadata and signed URL from Supabase Storage
→ function calls Lovable AI speech-to-text using LOVABLE_API_KEY
→ function replaces transcript_segments for that session
→ function stores transcript_versions and audit_logs
→ updated transcript data is returned to UI
```

Finding:
Authorization has two layers: route-level server function authorization and database/storage RLS.

Evidence:
Routes call `requireSession()` or `guardRouteAccess()`; server functions use `requireSupabaseAuth`; migrations enable RLS and create table/storage policies based on auth UID, case membership, and session access.

Files:
`src/lib/route-guards.ts`, `src/lib/permissions.functions.ts`, `src/integrations/supabase/auth-middleware.ts`, `supabase/migrations/*.sql`

Confidence:
High

## Data Ownership

| Entity | Ownership/access evidence | Summary |
| --- | --- | --- |
| Profiles | Profile `id` references `auth.users(id)` and RLS allows users to select/update/insert their own profile | Owned by Supabase auth user |
| User roles | `user_roles.user_id` references auth user; users can select their own roles | Role assignment table, not stored on profile |
| Cases | `created_by` references auth user; case access is creator/member/demo based | Creator owns; members can access; demo cases visible |
| Case members | Links `case_id` to `user_id`; creator/members can add/remove per RLS | Case membership controls collaboration |
| Sessions | Belong to cases; RLS checks parent case membership/demo | Access inherited from case |
| Evidence/recordings/transcripts | Belong to sessions; RLS checks `can_access_session(session_id)` | Access inherited from session/case |
| Audit logs | Actor/case/session metadata; users can insert own audit rows and read logs for cases they belong to | Actor-owned writes, case-scoped reads |

## Database Relationship Summary

```text
auth.users
├── profiles(id)
├── user_roles(user_id)
├── cases(created_by)
└── case_members(user_id)

cases
├── case_members(case_id)
├── sessions(case_id)
└── audit_logs(case_id)

sessions
├── evidence(session_id)
├── recordings(session_id)
├── transcript_segments(session_id)
└── audit_logs(session_id)

transcript_segments
└── transcript_versions(segment_id)
```

Core entities: `profiles`, `user_roles`, `cases`, `case_members`, `sessions`, `audit_logs`, `evidence`, `recordings`, `transcript_segments`, `transcript_versions`.

High-risk schema areas: RLS helper functions and storage policies depend on folder naming where the first storage path segment is cast to a session UUID; if object paths do not follow that convention, access checks may fail or error.

## Endpoint Inventory

TanStack Start server functions are the internal API surface; generated HTTP RPC paths are framework-managed rather than hand-authored REST routes.

| Domain | Function | Method | Tables/storage/external service | Ownership |
| --- | --- | --- | --- | --- |
| Cases | `listCases` | GET | `cases` | Case service module |
| Cases | `getCaseDetail` | GET | `cases`, `sessions` | Case service module |
| Cases | `createCase` | POST | `cases`, `case_members`, `audit_logs` | Case service module |
| Cases | `getDashboardMetrics` | GET | `cases`, `sessions` | Case service module |
| Sessions | `listSessionsByCase` | GET | `sessions` | Session service module |
| Sessions | `getSessionById` | GET | `sessions` | Session service module |
| Sessions | `createSession` | POST | `sessions`, `audit_logs` | Session service module |
| Permissions | `getMyRoles` | GET | `user_roles` | Permissions module |
| Permissions | `authorizeRoute` | POST | `user_roles`, `audit_logs` | Permissions module |
| Permissions | `requireAuthenticated` | GET | Supabase auth claims | Permissions module |
| Evidence | `listEvidence` | GET | `evidence` | Evidence module |
| Evidence | `recordEvidence` | POST | `evidence`, `audit_logs` | Evidence module |
| Evidence | `getEvidenceSignedUrl` | POST | `evidence`, storage bucket `evidence` | Evidence module |
| Evidence | `deleteEvidence` | POST | `evidence`, storage bucket `evidence`, `audit_logs` | Evidence module |
| Recordings | `listRecordings` | GET | `recordings` | Recordings module |
| Recordings | `recordRecording` | POST | `recordings`, `audit_logs` | Recordings module |
| Recordings | `getRecordingSignedUrl` | POST | `recordings`, storage bucket `recordings` | Recordings module |
| Recordings | `deleteRecording` | POST | `recordings`, storage bucket `recordings`, `audit_logs` | Recordings module |
| Transcripts | `listTranscript` | GET | `transcript_segments` | Transcript module |
| Transcripts | `saveTranscript` | POST | `transcript_segments`, `transcript_versions`, `audit_logs` | Transcript module |
| Transcripts | `updateSegment` | POST | `transcript_segments`, `transcript_versions`, `audit_logs` | Transcript module |
| Transcripts | `getSegmentVersions` | GET | `transcript_versions` | Transcript module |
| Transcripts/AI | `transcribeRecording` | POST | `recordings`, storage bucket `recordings`, Lovable AI API, `transcript_segments`, `transcript_versions`, `audit_logs` | Transcript module |
| Claims | `listClaimsBySession` | GET | `ai_claims`, `claim_anchors`, `transcript_segments` | Claims module |
| Claims | `listReviewClaims` | GET | `ai_claims`, `claim_anchors`, `transcript_segments`, `sessions` | Claims module |
| Claims | `updateClaimReview` | POST | `ai_claims`, `audit_logs` | Claims module |

### External APIs

| External API | Usage | Evidence |
| --- | --- | --- |
| Supabase Auth/Postgres/Storage | Authentication, RLS-protected data access, signed URLs | `src/integrations/supabase/*`, `src/lib/*.functions.ts`, `supabase/migrations/*.sql` |
| Lovable Cloud Auth | Google OAuth broker | `src/routes/auth.tsx`, `src/integrations/lovable/index.ts` |
| Lovable AI speech-to-text | Recording transcription | `src/lib/transcript.functions.ts` |

## API gaps and dead-code observations

Finding:
Some UI surfaces still use mock/demo data instead of persisted backend tables.

Evidence:
Team and dashboard activity still import `src/lib/mock-data.ts`; project overview and handoff route identify broader production backend wiring needs. Claims/review/report flows now have persisted `ai_claims` and `claim_anchors` APIs.

Files:
`src/routes/_authenticated.team.tsx`, `src/routes/_authenticated.index.tsx`, `src/lib/claims.functions.ts`, `src/lib/mock-data.ts`, `PROJECT_OVERVIEW.md`

Confidence:
High

Finding:
No duplicate exported server-function names were found during text inventory.

Evidence:
`rg` over `export const ... = createServerFn` showed unique function names across server-function modules.

Files:
`src/lib/*.functions.ts`

Confidence:
Medium
