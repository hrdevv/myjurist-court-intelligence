import type { SessionExportManifest } from "@/lib/export.functions";
import type { TranscriptSegmentRow } from "@/lib/transcript.functions";

/** `123456` ms -> `02:03`, or `1:02:03` past an hour. */
export function formatTimestamp(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "--:--";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Safe, lowercase filename fragment. */
export function slugify(value: string, fallback = "session"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

export interface TranscriptExportSegment {
  id: string;
  index: number;
  speaker: string;
  startMs: number | null;
  endMs: number | null;
  timestamp: string;
  text: string;
  confidence: string;
  version: number;
  updatedAt: string;
}

export function toExportSegments(segments: TranscriptSegmentRow[]): TranscriptExportSegment[] {
  return segments.map((seg, i) => ({
    id: seg.id,
    index: i + 1,
    speaker: seg.speaker,
    startMs: seg.start_ms,
    endMs: seg.end_ms,
    timestamp: seg.timestamp_label ?? formatTimestamp(seg.start_ms),
    text: seg.text,
    confidence: seg.confidence,
    version: seg.version,
    updatedAt: seg.updated_at,
  }));
}

export function transcriptToJson(manifest: SessionExportManifest): string {
  return JSON.stringify(
    {
      session: manifest.session,
      exportedAt: manifest.exportedAt,
      notice: manifest.notice,
      segmentCount: manifest.transcript.length,
      segments: toExportSegments(manifest.transcript),
    },
    null,
    2,
  );
}

export function transcriptToText(manifest: SessionExportManifest): string {
  const header = [
    manifest.session.title,
    manifest.session.caseTitle
      ? `Case: ${manifest.session.caseTitle}${
          manifest.session.caseReference ? ` (${manifest.session.caseReference})` : ""
        }`
      : null,
    manifest.session.date ? `Date: ${manifest.session.date}` : null,
    `Exported: ${manifest.exportedAt}`,
    "",
    manifest.notice,
    "",
    "----------------------------------------",
    "",
  ].filter((l): l is string => l !== null);

  const body = toExportSegments(manifest.transcript).map(
    (seg) => `[${seg.timestamp}] ${seg.speaker}: ${seg.text}`,
  );

  const lines = [...header, ...(body.length > 0 ? body : ["(No transcript segments yet.)"])];
  return `${lines.join("\n")}\n`;
}

/** `manifest.json` payload describing the bundle contents. */
export function bundleManifestJson(
  manifest: SessionExportManifest,
  files: { recordingId: string; wav?: string; mp3?: string }[],
): string {
  return JSON.stringify(
    {
      session: manifest.session,
      exportedAt: manifest.exportedAt,
      exportedBy: manifest.exportedBy,
      notice: manifest.notice,
      transcript: { segmentCount: manifest.transcript.length },
      recordings: manifest.recordings.map((r) => {
        const f = files.find((x) => x.recordingId === r.id);
        return {
          id: r.id,
          createdAt: r.createdAt,
          durationSeconds: r.durationSeconds,
          sizeBytes: r.sizeBytes,
          mime: r.mime,
          sha256: r.checksum,
          status: r.status,
          files: { wav: f?.wav ?? null, mp3: f?.mp3 ?? null },
        };
      }),
    },
    null,
    2,
  );
}

export interface DecodedWav {
  sampleRate: number;
  channels: number;
  samples: Int16Array;
}

/** Minimal RIFF/PCM16 WAV reader for the recordings this app produces. */
export function decodeWav(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer);
  const tag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");

  let offset = 12;
  let sampleRate = 16000;
  let channels = 1;
  let bits = 16;
  let dataStart = -1;
  let dataLength = 0;

  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === "data") {
      dataStart = body;
      dataLength = Math.min(size, view.byteLength - body);
      break;
    }
    offset = body + size + (size % 2);
  }

  if (dataStart < 0) throw new Error("WAV file has no data chunk");
  if (bits !== 16) throw new Error(`Unsupported WAV bit depth: ${bits}`);

  return {
    sampleRate,
    channels: channels || 1,
    samples: new Int16Array(buffer.slice(dataStart, dataStart + (dataLength - (dataLength % 2)))),
  };
}

const MP3_KBPS = 64;

/**
 * Transcodes a PCM16 WAV to MP3 in the browser. CPU-bound, so it encodes in
 * chunks and yields to the event loop between them to keep the UI responsive.
 */
export async function wavToMp3(buffer: ArrayBuffer): Promise<Uint8Array> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const { sampleRate, channels, samples } = decodeWav(buffer);
  const encoder = new Mp3Encoder(channels === 2 ? 2 : 1, sampleRate, MP3_KBPS);
  const blockSize = 1152 * (channels === 2 ? 2 : 1);
  const parts: Uint8Array[] = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, Math.min(i + blockSize, samples.length));
    let chunk: Uint8Array;
    if (channels === 2) {
      const frames = Math.floor(block.length / 2);
      const left = new Int16Array(frames);
      const right = new Int16Array(frames);
      for (let f = 0; f < frames; f += 1) {
        left[f] = block[f * 2];
        right[f] = block[f * 2 + 1];
      }
      chunk = encoder.encodeBuffer(left, right);
    } else {
      chunk = encoder.encodeBuffer(block);
    }
    if (chunk.length > 0) parts.push(new Uint8Array(chunk));
    if ((i / blockSize) % 200 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  const tail = encoder.flush();
  if (tail.length > 0) parts.push(new Uint8Array(tail));

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** `audio/2026-08-17T10-12-33-ab12cd34` (no extension). */
export function recordingBaseName(createdAt: string, id: string): string {
  const stamp = createdAt.replace(/\.\d+Z?$/, "").replace(/[:.]/g, "-");
  return `audio/${stamp}-${id.slice(0, 8)}`;
}

export function bundleFileName(manifest: SessionExportManifest): string {
  const date = manifest.session.date ?? manifest.exportedAt.slice(0, 10);
  return `session-${slugify(manifest.session.title)}-${date}.zip`;
}
