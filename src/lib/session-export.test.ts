import { describe, expect, it } from "vitest";
import type { SessionExportManifest } from "@/lib/export.functions";
import type { TranscriptSegmentRow } from "@/lib/transcript.functions";
import {
  bundleFileName,
  formatTimestamp,
  recordingBaseName,
  slugify,
  transcriptToJson,
  transcriptToText,
} from "@/lib/session-export";

function segment(overrides: Partial<TranscriptSegmentRow>): TranscriptSegmentRow {
  return {
    id: "seg-1",
    session_id: "s-1",
    start_ms: 0,
    end_ms: 1000,
    timestamp_label: null,
    speaker: "COURT",
    text: "All rise.",
    confidence: "high",
    version: 1,
    created_at: "2026-08-17T10:00:00.000Z",
    updated_at: "2026-08-17T10:00:00.000Z",
    ...overrides,
  };
}

function manifest(segments: TranscriptSegmentRow[]): SessionExportManifest {
  return {
    session: {
      id: "s-1",
      title: "Land Dispute Hearing",
      date: "2026-08-17",
      status: "draft",
      caseId: "c-1",
      caseTitle: "Doe v. Roe",
      caseReference: "HC/2026/001",
    },
    transcript: segments,
    recordings: [],
    exportedAt: "2026-08-17T12:00:00.000Z",
    exportedBy: "u-1",
    notice: "AI-assisted output.",
  };
}

describe("formatTimestamp", () => {
  it("formats minutes and seconds", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(123_000)).toBe("02:03");
  });

  it("includes hours past 60 minutes", () => {
    expect(formatTimestamp(3_723_000)).toBe("1:02:03");
  });

  it("falls back for missing values", () => {
    expect(formatTimestamp(null)).toBe("--:--");
  });
});

describe("transcript serializers", () => {
  it("keeps segment order and numbers them", () => {
    const json = JSON.parse(
      transcriptToJson(
        manifest([
          segment({ id: "a", start_ms: 0, text: "First" }),
          segment({ id: "b", start_ms: 5000, text: "Second" }),
        ]),
      ),
    );
    expect(json.segmentCount).toBe(2);
    expect(json.segments.map((s: { index: number; id: string }) => [s.index, s.id])).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("renders text lines with timestamp and speaker", () => {
    const text = transcriptToText(manifest([segment({ start_ms: 65_000, speaker: "WITNESS" })]));
    expect(text).toContain("[01:05] WITNESS: All rise.");
    expect(text).toContain("Case: Doe v. Roe (HC/2026/001)");
  });

  it("prefers an explicit timestamp label when present", () => {
    const text = transcriptToText(manifest([segment({ timestamp_label: "00:09:30" })]));
    expect(text).toContain("[00:09:30]");
  });

  it("handles an empty transcript", () => {
    const empty = manifest([]);
    expect(JSON.parse(transcriptToJson(empty)).segments).toEqual([]);
    expect(transcriptToText(empty)).toContain("(No transcript segments yet.)");
  });
});

describe("file names", () => {
  it("slugifies titles", () => {
    expect(slugify("Land Dispute — Hearing #2")).toBe("land-dispute-hearing-2");
    expect(slugify("!!!")).toBe("session");
  });

  it("names the bundle from session title and date", () => {
    expect(bundleFileName(manifest([]))).toBe("session-land-dispute-hearing-2026-08-17.zip");
  });

  it("names audio files safely", () => {
    expect(recordingBaseName("2026-08-17T10:12:33.451Z", "ab12cd34-0000")).toBe(
      "audio/2026-08-17T10-12-33-ab12cd34",
    );
  });
});
