# Session Export Bundle (transcript + audio)

Add a one-click "Export session" action that downloads a single ZIP containing the session's transcript (JSON + plain text) and every recording as WAV plus an MP3 copy.

## What the user gets

On the session page (next to "Preview Report"), an **Export bundle** button opens a small dialog:

- Checkboxes: include transcript (JSON), include transcript (TXT), include audio WAV, include audio MP3.
- Shows the recording count and approximate size, then a progress line ("Encoding 2 of 3…").
- Result: `session-<title>-<date>.zip` downloaded by the browser.

ZIP contents:

```text
manifest.json          session + case metadata, export timestamp, exported-by, AI-mode notice
transcript.json        ordered segments: id, index, speaker, start/end, text, version
transcript.txt         [00:12] SPEAKER: text …
audio/<created-at>-<id>.wav
audio/<created-at>-<id>.mp3
```

Each audio entry is listed in `manifest.json` with duration, size, SHA-256 checksum and its filenames, so the bundle stays chain-of-custody friendly.

## Technical approach

- New `src/lib/export.functions.ts` with `getSessionExportManifest` (auth'd, `requireSupabaseAuth`): returns session/case metadata, transcript segments, and recording rows with fresh signed URLs — one round trip instead of per-recording calls. RLS keeps it scoped to session members; writes an `audit_logs` row with action `session.exported`.
- Bundling happens in the browser (recordings can be large; the edge runtime is not a good place to buffer them):
  - `client-zip` for streaming ZIP creation (tiny, Worker/browser-safe).
  - `@breezystack/lamejs` (pure-JS MP3 encoder) to transcode the stored 16 kHz mono WAV to MP3 at 64 kbps mono. Runs in a `Web Worker` created from a blob URL so the UI stays responsive; falls back to main-thread encoding if workers are unavailable, and skips MP3 with a toast if encoding fails (WAV still included).
  - WAV bytes are fetched from the signed URLs directly, so no proxying through the server.
- New `src/lib/session-export.ts` (browser-safe helpers): transcript JSON/TXT serializers, timestamp formatter, filename slugger, WAV→MP3 encode.
- New `src/components/sessions/ExportBundleDialog.tsx` holding the dialog, option state, progress and download trigger; mounted from `src/routes/_authenticated.sessions.$sessionId.index.tsx`.
- No schema changes. No new buckets or policies.

## Verification

- Typecheck plus a unit test for the transcript serializers (ordering, timestamp format, empty transcript).
- Manual check in the preview: record a short clip, export, confirm the ZIP opens with a playable WAV and MP3 and a matching manifest.

## Notes

- MP3 encoding is CPU-bound in the browser; for a long hearing this can take a while. The dialog shows progress and MP3 stays optional so users can grab WAV-only instantly.
- If you'd rather ship a server-side export later, the manifest server function is already the seam for it.
