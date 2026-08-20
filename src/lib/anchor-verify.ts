// Deterministic anchor verifier.
//
// The AI model proposes a claim plus the verbatim quote(s) it believes support
// it. Nothing the model says about "verification" is trusted: this module is
// the single source of truth for whether a claim is anchored, and it is pure,
// synchronous and fully deterministic so the same inputs always yield the same
// anchor status (and so it can be unit-tested without a model or a database).

import type { AnchorStatus } from "@/lib/mock-data";

export interface VerifiableSegment {
  id: string;
  text: string;
}

export interface AnchorVerdict {
  /** Segment the quote was matched to, or null when nothing matched. */
  segmentId: string | null;
  status: AnchorStatus;
  /** 0..1 similarity of the quote against the matched segment. */
  score: number;
  /** The normalized quote that was verified, for audit purposes. */
  quote: string;
}

/** Similarity at or above which an exact-containment miss is still a suggestion. */
export const SUGGESTED_THRESHOLD = 0.6;
/** Minimum normalized quote length considered verifiable at all. */
export const MIN_QUOTE_CHARS = 12;

/** Lowercases, strips punctuation and collapses whitespace. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(input: string): string[] {
  return normalizeText(input).split(" ").filter(Boolean);
}

/**
 * Dice coefficient over token bigrams (falls back to unigram overlap for very
 * short quotes). Symmetric, bounded to 0..1 and order-sensitive enough to
 * distinguish a real quote from an unrelated sentence.
 */
export function similarity(a: string, b: string): number {
  const at = tokens(a);
  const bt = tokens(b);
  if (at.length === 0 || bt.length === 0) return 0;

  const grams = (t: string[]): string[] =>
    t.length < 2 ? t : t.slice(0, -1).map((word, i) => `${word} ${t[i + 1]}`);

  const ag = grams(at);
  const bg = grams(bt);
  const pool = new Map<string, number>();
  for (const g of bg) pool.set(g, (pool.get(g) ?? 0) + 1);

  let hits = 0;
  for (const g of ag) {
    const left = pool.get(g) ?? 0;
    if (left > 0) {
      hits += 1;
      pool.set(g, left - 1);
    }
  }
  return (2 * hits) / (ag.length + bg.length);
}

/**
 * Verifies one quote against the session's transcript segments.
 *
 * - `verified`: the normalized quote appears verbatim inside a segment.
 * - `suggested`: the closest segment is similar enough to be worth a human
 *   look, but is not a verbatim match.
 * - `failed`: nothing in the transcript supports the quote — or the model
 *   returned no usable quote at all.
 */
export function verifyQuote(quote: string, segments: readonly VerifiableSegment[]): AnchorVerdict {
  const normalizedQuote = normalizeText(quote ?? "");
  if (normalizedQuote.length < MIN_QUOTE_CHARS) {
    return { segmentId: null, status: "failed", score: 0, quote: normalizedQuote };
  }

  let best: AnchorVerdict = {
    segmentId: null,
    status: "failed",
    score: 0,
    quote: normalizedQuote,
  };

  for (const segment of segments) {
    const normalizedSegment = normalizeText(segment.text);
    if (!normalizedSegment) continue;

    if (normalizedSegment.includes(normalizedQuote)) {
      return { segmentId: segment.id, status: "verified", score: 1, quote: normalizedQuote };
    }

    const score = similarity(normalizedQuote, normalizedSegment);
    if (score > best.score) {
      best = {
        segmentId: segment.id,
        status: score >= SUGGESTED_THRESHOLD ? "suggested" : "failed",
        score,
        quote: normalizedQuote,
      };
    }
  }

  // A weak best match is not an anchor at all.
  if (best.status === "failed") {
    return { ...best, segmentId: null };
  }
  return best;
}

/** Verifies every quote a model proposed for one claim, de-duplicating segments. */
export function verifyQuotes(
  quotes: readonly string[],
  segments: readonly VerifiableSegment[],
): AnchorVerdict[] {
  const verdicts: AnchorVerdict[] = [];
  const seen = new Set<string>();
  for (const quote of quotes) {
    const verdict = verifyQuote(quote, segments);
    const key = verdict.segmentId ?? `failed:${verdict.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    verdicts.push(verdict);
  }
  return verdicts;
}

/**
 * Derives the claim-level support and confidence from anchor verdicts alone.
 * The model never sets these — support is a function of verified anchors, so an
 * unanchored claim can never present itself as supported.
 */
export function deriveSupport(verdicts: readonly AnchorVerdict[]): {
  support: "supported" | "partially_supported" | "unsupported";
  confidence: "high" | "medium" | "low" | "unsupported";
  warning?: string;
} {
  const verified = verdicts.filter((v) => v.status === "verified").length;
  const suggested = verdicts.filter((v) => v.status === "suggested").length;

  if (verified > 0 && suggested === 0 && verified === verdicts.length) {
    return { support: "supported", confidence: "high" };
  }
  if (verified > 0) {
    return { support: "partially_supported", confidence: "medium" };
  }
  if (suggested > 0) {
    return {
      support: "unsupported",
      confidence: "low",
      warning:
        "No verbatim transcript match. The closest segment is a suggestion only and must be confirmed by a human reviewer.",
    };
  }
  return {
    support: "unsupported",
    confidence: "unsupported",
    warning:
      "No anchor found in the transcript. This claim cannot enter a report unless a reviewer confirms it manually.",
  };
}
