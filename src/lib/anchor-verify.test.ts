import { describe, expect, it } from "vitest";
import {
  deriveSupport,
  normalizeText,
  similarity,
  verifyQuote,
  verifyQuotes,
} from "@/lib/anchor-verify";

const segments = [
  { id: "s1", text: "I never entered the building on the night of the fifth." },
  { id: "s2", text: "The gate was locked when we arrived, so we waited outside." },
  { id: "s3", text: "Counsel produced the survey plan dated March 2019." },
];

describe("normalizeText", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeText("  The   GATE, was locked! ")).toBe("the gate was locked");
  });
});

describe("similarity", () => {
  it("is 1 for identical text and 0 for disjoint text", () => {
    expect(similarity("the gate was locked", "the gate was locked")).toBe(1);
    expect(similarity("the gate was locked", "survey plan dated march")).toBe(0);
  });
});

describe("verifyQuote", () => {
  it("marks a verbatim quote as verified against its segment", () => {
    const verdict = verifyQuote("I never entered the building", segments);
    expect(verdict).toMatchObject({ segmentId: "s1", status: "verified", score: 1 });
  });

  it("ignores punctuation and casing differences", () => {
    const verdict = verifyQuote("the GATE was locked, when we arrived", segments);
    expect(verdict.status).toBe("verified");
    expect(verdict.segmentId).toBe("s2");
  });

  it("marks a近-miss paraphrase as suggested, not verified", () => {
    const verdict = verifyQuote("the gate was locked when we got there so we waited", segments);
    expect(verdict.status).toBe("suggested");
    expect(verdict.segmentId).toBe("s2");
    expect(verdict.score).toBeGreaterThan(0);
    expect(verdict.score).toBeLessThan(1);
  });

  it("fails a fabricated quote with no transcript support", () => {
    const verdict = verifyQuote("the witness admitted to forging the deed", segments);
    expect(verdict.status).toBe("failed");
    expect(verdict.segmentId).toBeNull();
  });

  it("fails an empty or too-short quote", () => {
    expect(verifyQuote("", segments).status).toBe("failed");
    expect(verifyQuote("the gate", segments).status).toBe("failed");
  });
});

describe("verifyQuotes", () => {
  it("de-duplicates verdicts pointing at the same segment", () => {
    const verdicts = verifyQuotes(
      ["I never entered the building", "never entered the building on the night"],
      segments,
    );
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].segmentId).toBe("s1");
  });
});

describe("deriveSupport", () => {
  it("treats fully verified anchors as supported and high confidence", () => {
    const result = deriveSupport([
      { segmentId: "s1", status: "verified", score: 1, quote: "a" },
      { segmentId: "s2", status: "verified", score: 1, quote: "b" },
    ]);
    expect(result).toEqual({ support: "supported", confidence: "high" });
  });

  it("downgrades a mix of verified and suggested anchors", () => {
    const result = deriveSupport([
      { segmentId: "s1", status: "verified", score: 1, quote: "a" },
      { segmentId: "s2", status: "suggested", score: 0.7, quote: "b" },
    ]);
    expect(result.support).toBe("partially_supported");
    expect(result.confidence).toBe("medium");
  });

  it("marks suggestion-only claims unsupported with a warning", () => {
    const result = deriveSupport([{ segmentId: "s2", status: "suggested", score: 0.7, quote: "b" }]);
    expect(result.support).toBe("unsupported");
    expect(result.confidence).toBe("low");
    expect(result.warning).toBeTruthy();
  });

  it("marks unanchored claims unsupported with a warning", () => {
    const result = deriveSupport([]);
    expect(result.support).toBe("unsupported");
    expect(result.confidence).toBe("unsupported");
    expect(result.warning).toBeTruthy();
  });
});
