# Goal

Give every transcript/segment/claim/anchor callback parameter in the session review screens an explicit, correct type, and confirm the whole project type-checks with zero implicit-any errors.

# Current state

A baseline `tsc --noEmit` already passes (exit 0). The session screens "work" but are messy:
- They use verbose inline `import("@/lib/mock-data").AIClaim` / `...AnchorStatus` / `...TranscriptSegment` annotations repeated dozens of times.
- `src/routes/review.tsx` has fully-inferred (untyped) callbacks (`s`, `c`) that rely on inference rather than explicit types.

# Changes

### 1. Clean named type imports (no inline `import(...)`)
In each of these files, import the needed types once at the top and replace every inline `import("@/lib/mock-data").X` annotation with the imported name:
- `src/routes/sessions.$sessionId.review.tsx`
- `src/routes/sessions.$sessionId.index.tsx`
- `src/routes/sessions.$sessionId.report.tsx`

Types involved: `AIClaim`, `TranscriptSegment`, `EvidenceFile`, `AnchorStatus`.

Introduce a small shared anchor type to replace the repeated `{ segmentId: string; status: AnchorStatus }` literals. Use `AIClaim["anchors"][number]` so the annotation always matches the data model.

### 2. Explicit segment/transcript callback types
- In `sessions.$sessionId.review.tsx`, keep `seg: ReturnType<typeof getSegment>` (already correct) and ensure the `sourceSegments` `.map((a) => ...)` anchor param is typed via the shared anchor type.
- In `sessions.$sessionId.index.tsx`, the `session.transcript.map((seg: TranscriptSegment) => ...)` becomes a clean named annotation.

### 3. Type the remaining inferred callbacks in `review.tsx`
- Annotate the `flatMap`/`map` params: `s: Session`, `c: AIClaim`, and the rendered `all.map((c) => ...)` item type (claim plus `sessionId`/`sessionTitle`). Add `Session` to the import.

### 4. Verify
- Run `npx tsc --noEmit` and confirm exit 0 with no `TS7006` (implicit-any) or other errors across the project.

# Technical notes

- Pure presentation/type-annotation refactor — no logic, data, or UI behavior changes.
- All types already exist and are exported from `src/lib/mock-data.ts`; no schema changes.
- Do not edit `src/routeTree.gen.ts`.
