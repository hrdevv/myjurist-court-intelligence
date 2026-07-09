# Backend Integration Plan — Courtroom Intelligence MVP

Take the current mock-data prototype to a real, running application on **Lovable Cloud** (built-in Postgres, auth, storage, server functions, Lovable AI). Auth, roles (`user_roles` + `has_role`), permission server functions, and route guards already exist — this plan wires real data, recording, transcription, playback, and export behind them.

> Note on the handoff notes: `06_BACKEND_HANDOFF_NOTES.md` assumes Laravel 11 + MySQL + Gemini. That stack does not run inside Lovable. This plan implements the **equivalent capabilities** natively on Lovable Cloud and keeps the handoff's REST endpoint list as a functional checklist (every listed route maps to a server function below). See Recommendations for portability.

## Execution scope
Phased, foundation first. **Phase 1 executes now**; later phases follow on approval. All phases are mapped so nothing is missed.

---

## Data model (Postgres, all under RLS + GRANTs)

Existing: `profiles`, `user_roles`, `has_role()`.

New tables:
- `cases` — title, reference, court, status, created_by
- `case_members` — case_id, user_id, role (tenant/case scoping; drives RLS)
- `sessions` — case_id, title, date, status
- `recordings` — session_id, storage_path, duration_seconds, mime, size_bytes, checksum, status (recording/uploaded/transcribing/transcribed/failed)
- `evidence` — session_id, name, type, storage_path, size_bytes, checksum, description, status
- `transcript_segments` — session_id, start_ms, end_ms, timestamp_label, speaker, text, confidence, version
- `transcript_versions` — segment_id, version, text, edited_by (edit history)
- `ai_claims` — session_id, type, text, confidence, support, review_status, reviewer_note, warning
- `claim_anchors` — claim_id, segment_id, status (verified/suggested/failed/none/manual)
- `review_decisions` — claim_id, decision, note, decided_by
- `reports` — session_id, status, disclaimer, generated_at
- `audit_logs` — actor_id, case_id, session_id, action, detail

RLS pattern: a user sees/edits a row only if they belong to the parent case via `case_members` (a `security definer` helper `is_case_member(case_id)` avoids recursion), combined with `has_role` for privileged actions (approve report = Lawyer/Reviewer). Each `CREATE TABLE` ships with GRANTs (`authenticated`, `service_role`) in the same migration.

Seed migration inserts the demo "Land Dispute Hearing Demo" case + session + transcript + claims (from `04_MOCK_DATA_SPEC.md`) so the app looks identical to today on first load.

## Storage
Two **private** buckets: `recordings` and `evidence`. Access only via signed URLs minted server-side after a `case_members` check. SHA-256 checksums computed on upload and stored for integrity ("No anchor, no authority").

---

## Phase 1 — Foundation (execute now)
1. Migration: `cases`, `case_members`, `sessions`, `audit_logs` + RLS + GRANTs + `is_case_member()` helper.
2. Seed migration: demo case/session.
3. Server functions (`src/lib/*.functions.ts`, `requireSupabaseAuth`): `listCases`, `getCase`, `createCase`, `listSessions`, `getSession`, `createSession`, `getDashboardMetrics`, `logAudit`.
4. Wire routes off DB instead of `mock-data.ts`: `_authenticated.index` (dashboard), `cases.index`, `cases.$caseId`, `sessions.$sessionId` shell. Loaders use TanStack Query (`ensureQueryData` + `useSuspenseQuery`).
5. Keep `mock-data.ts` only for not-yet-migrated screens; remove per phase.

## Phase 2 — Evidence + Transcript storage
- `evidence`, `transcript_segments`, `transcript_versions` tables + RLS.
- Create `evidence` bucket; real upload with checksum + signed-URL download; wire evidence panel.
- Transcript viewer/editor reads/writes DB; edits create a `transcript_versions` row (version history indicator becomes real).

## Phase 3 — Recording, transcription, playback, export
- ✅ `recordings` bucket + table (RLS via `can_access_session`, GRANTs, integrity checksum).
- ✅ **In-browser recording**: capture mic via Web Audio API, encode complete WAV (16 kHz mono), upload to `recordings` bucket (guards against empty/silent clips). Consent notice shown before capture.
- ✅ **Playback player** (reusable component over a signed URL): play/pause, seek bar, **rewind/forward 5s**, current-time/duration, playback speed. (Segment-click-to-seek pending transcription wiring.)
- ⏳ **Transcription**: server function posts the recording to Lovable AI `openai/gpt-4o-transcribe` (`/v1/audio/transcriptions`) with timestamps; results become `transcript_segments` (start_ms/end_ms/text/confidence) linked to the session.
- ⏳ **Export**: audio download (signed URL); transcript export to `.txt` and `.pdf`; combined "transcript + audio" package.

## Phase 4 — AI claims + review
- `ai_claims`, `claim_anchors`, `review_decisions` tables + RLS.
- "Generate Review Draft" server function calls Lovable AI (`openai/gpt-5.5`, structured output) over transcript to produce candidate claims using **safe labels** (`Possible inconsistency candidate`, etc.).
- **Deterministic anchor verifier** (`07_..._ANCHORING_RULES.md`): exact quote / timestamp overlap = verified; fuzzy = suggested; none = unsupported. Runs server-side, sets anchor status.
- Review console + review queue wired to DB; Approve/Reject/Edit-and-Approve/Mark Uncertain/Needs More Evidence write `review_decisions` and update claim status. Role-gated (Lawyer/Reviewer).

## Phase 5 — Reports, audit, hardening
- `reports` table + report generation applying inclusion rules (approved only; unsupported/rejected excluded; disclaimer embedded).
- Report export to PDF.
- Audit logging wired into every state change (create, upload, transcribe, review, export).
- `AI_MODE` setting (`disabled`/`demo`/`live`) controlling whether AI calls hit Lovable AI or return demo fixtures; demo banner reflects it.
- Final RLS/role review; ensure every mutating server function authorizes the caller.

---

## Handoff endpoint → server-function mapping
`GET /dashboard`→`getDashboardMetrics` · `GET/POST /cases`→`listCases`/`createCase` · `GET /cases/{id}`→`getCase` · `POST /cases/{id}/sessions`→`createSession` · `GET /sessions/{id}`→`getSession` · `POST .../evidence`→`uploadEvidence` · `POST .../transcript`→`saveTranscript` · `POST .../ai/generate-review-draft`→`generateReviewDraft` · `GET .../claims`→`listClaims` · `POST /claims/{id}/review`→`reviewClaim` · `GET .../report`→`getReport` · `POST .../export`→`exportSession`. Plus new: `startRecording`/`finalizeRecording`, `transcribeRecording`, `getSignedMediaUrl`.

## Technical notes
- App-internal logic = `createServerFn`; webhooks/public = server routes. No Laravel, no Supabase edge functions for app logic.
- Recording/transcription follow the WAV-upload rules (complete decodable files, not `MediaRecorder` fragments) to avoid provider 400s.
- Bearer attach already registered in `src/start.ts`; protected loaders stay under `_authenticated`.

## Recommendations
1. **Live-recording tension**: the original spec (`00`, `08`) explicitly excluded live courtroom recording. You've chosen to add it — I'll add a clear consent/legality notice and keep it session-scoped, not "live courtroom" framed.
2. **Privacy/retention**: recordings + evidence are sensitive; keep buckets private, add a retention policy field and future deletion job. Never expose signed URLs beyond members.
3. **Cost control**: transcription and claim generation are billed per request — add `AI_MODE` (demo/live) and a per-session "re-transcribe" guard to avoid duplicate spend.
4. **Portability**: if a Laravel deployment is still required later, the server-function contract above doubles as the API spec — I can emit an OpenAPI doc from it.
5. **Integrity**: store SHA-256 checksums and surface them in the evidence UI to back the "verified anchor" model.
