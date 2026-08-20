import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ROLE_GROUPS, type AppRole } from "@/lib/permissions";
import { deriveSupport, verifyQuotes, type VerifiableSegment } from "@/lib/anchor-verify";
import type { AnchorStatus, ClaimType, ConfidenceLevel, ReviewStatus } from "@/lib/mock-data";

export interface ClaimAnchorRow {
  id: string;
  claim_id: string;
  segment_id: string | null;
  status: AnchorStatus;
  quote: string | null;
  match_score: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface ClaimRow {
  id: string;
  session_id: string;
  type: ClaimType;
  text: string;
  confidence: ConfidenceLevel;
  support: "supported" | "partially_supported" | "unsupported";
  review_status: ReviewStatus;
  reviewer_note: string | null;
  warning: string | null;
  source_model: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimWithAnchors extends ClaimRow {
  anchors: ClaimAnchorRow[];
}

export interface QueueClaimRow extends ClaimWithAnchors {
  session_title: string;
}

const CLAIM_SELECT =
  "*, claim_anchors(id, claim_id, segment_id, status, quote, match_score, verified_at, created_at)";

type RawClaim = ClaimRow & { claim_anchors?: ClaimAnchorRow[] | null };

function shapeClaim(row: RawClaim): ClaimWithAnchors {
  const { claim_anchors, ...claim } = row;
  return { ...claim, anchors: claim_anchors ?? [] };
}

/** All claims for a session with their verified anchors. RLS scopes to members. */
export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ClaimWithAnchors[]> => {
    const { data: rows, error } = await context.supabase
      .from("claims")
      .select(CLAIM_SELECT)
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((rows ?? []) as unknown as RawClaim[]).map(shapeClaim);
  });

/**
 * Cross-session review queue: every claim the caller can access, newest first,
 * with its session title. Role-gated server-side to the review roles.
 */
export const listReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QueueClaimRow[]> => {
    await assertReviewRole(context);
    const { data: rows, error } = await context.supabase
      .from("claims")
      .select(`${CLAIM_SELECT}, sessions(title)`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return ((rows ?? []) as unknown as (RawClaim & { sessions?: { title: string } | null })[]).map(
      (row) => ({
        ...shapeClaim(row),
        session_title: row.sessions?.title ?? "Untitled session",
      }),
    );
  });

/** Server-side role gate for review writes: viewers may never review. */
async function assertReviewRole(context: {
  supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: AppRole }) => PromiseLike<{ data: boolean | null }> };
  userId: string;
}): Promise<void> {
  const allowed = ROLE_GROUPS.reviewQueue;
  for (const role of allowed) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return;
  }
  throw new Error(
    "Your role does not permit reviewing AI-assisted claims. Ask a lawyer or reviewer on the case for access.",
  );
}

const MODEL = "google/gemini-2.5-flash";

const claimSchema = z.object({
  claims: z
    .array(
      z.object({
        type: z
          .enum(["key_statement", "inconsistency_candidate", "unsupported_inference", "follow_up"])
          .catch("key_statement"),
        text: z.string().trim().min(1).max(1000),
        quotes: z.array(z.string().trim().min(1).max(1000)).max(5).default([]),
      }),
    )
    .max(30)
    .default([]),
});

const SYSTEM_PROMPT = `You are a legal analysis assistant preparing DRAFT claims from a hearing transcript for human review.

Rules:
- Only produce claims grounded in the transcript. Never invent facts, names, dates or admissions.
- For each claim, return the exact verbatim quote(s) copied character-for-character from the transcript that support it. Never paraphrase inside "quotes".
- Do not assert legal conclusions, guilt, liability or credibility findings.
- Classify each claim: "key_statement" (a material statement made), "inconsistency_candidate" (two parts of the transcript appear to conflict), "unsupported_inference" (a reading the transcript hints at but does not establish), "follow_up" (a question a lawyer should ask next).
- Return between 3 and 12 claims when the transcript allows.

Respond with JSON only: {"claims":[{"type":"...","text":"...","quotes":["..."]}]}`;

/**
 * Generates AI-assisted draft claims for a session, then anchors each claim to
 * the transcript with the deterministic verifier. Model output never decides
 * support or confidence: those are derived from verified anchors, so fabricated
 * or paraphrased quotes surface as `failed`/`suggested` anchors instead of
 * silently becoming report-ready statements. Replaces prior pending claims and
 * preserves any claim a human has already reviewed.
 */
export const generateClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ClaimWithAnchors[]> => {
    const { supabase, userId } = context;
    await assertReviewRole(context);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI claim generation is not configured.");

    const { data: segmentRows, error: segErr } = await supabase
      .from("transcript_segments")
      .select("id, timestamp_label, speaker, text")
      .eq("session_id", data.sessionId)
      .order("start_ms", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    if (segErr) throw segErr;

    const segments = (segmentRows ?? []) as {
      id: string;
      timestamp_label: string | null;
      speaker: string;
      text: string;
    }[];
    if (segments.length === 0) {
      throw new Error("This session has no transcript yet. Transcribe a recording first.");
    }

    const transcriptText = segments
      .map((s) => `[${s.timestamp_label ?? "--:--"}] ${s.speaker}: ${s.text}`)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Transcript:\n${transcriptText}` },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) {
        throw new Error("AI rate limit reached. Please retry in a moment.");
      }
      if (res.status === 402) {
        throw new Error("AI credits exhausted. Add credits to continue generating claims.");
      }
      throw new Error(`Claim generation failed (${res.status}). ${body}`.trim());
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "{}";

    let parsed: z.infer<typeof claimSchema>;
    try {
      parsed = claimSchema.parse(JSON.parse(content));
    } catch {
      throw new Error("The AI returned an unreadable draft. Please retry.");
    }
    if (parsed.claims.length === 0) {
      throw new Error("The AI found no supportable claims in this transcript.");
    }

    const verifiable: VerifiableSegment[] = segments.map((s) => ({ id: s.id, text: s.text }));

    // Clear previous un-reviewed drafts so regeneration never duplicates the
    // queue, while human decisions are preserved.
    const { error: delErr } = await supabase
      .from("claims")
      .delete()
      .eq("session_id", data.sessionId)
      .eq("review_status", "pending");
    if (delErr) throw delErr;

    const verifiedAt = new Date().toISOString();
    const created: ClaimWithAnchors[] = [];

    for (const draft of parsed.claims) {
      const verdicts = verifyQuotes(draft.quotes, verifiable);
      const derived = deriveSupport(verdicts);

      const { data: claimRow, error: claimErr } = await supabase
        .from("claims")
        .insert({
          session_id: data.sessionId,
          type: draft.type,
          text: draft.text,
          confidence: derived.confidence,
          support: derived.support,
          review_status: "pending",
          warning: derived.warning ?? null,
          source_model: MODEL,
          created_by: userId,
        })
        .select("*")
        .single();
      if (claimErr) throw claimErr;

      const anchorsToInsert = verdicts.map((v) => ({
        claim_id: (claimRow as ClaimRow).id,
        segment_id: v.segmentId,
        status: v.status,
        quote: v.quote,
        match_score: Number(v.score.toFixed(4)),
        verified_at: verifiedAt,
      }));

      let anchors: ClaimAnchorRow[] = [];
      if (anchorsToInsert.length > 0) {
        const { data: anchorRows, error: anchorErr } = await supabase
          .from("claim_anchors")
          .insert(anchorsToInsert)
          .select("*");
        if (anchorErr) throw anchorErr;
        anchors = (anchorRows ?? []) as unknown as ClaimAnchorRow[];
      }

      created.push({ ...(claimRow as ClaimRow), anchors });
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: data.sessionId,
      action: "claims.generated",
      detail: {
        model: MODEL,
        claims: created.length,
        verified_anchors: created.reduce(
          (n, c) => n + c.anchors.filter((a) => a.status === "verified").length,
          0,
        ),
        unanchored_claims: created.filter((c) => c.anchors.every((a) => a.status === "failed"))
          .length,
      },
    });

    return created;
  });

/**
 * Re-runs the deterministic verifier for every claim in a session against the
 * current transcript. Used after transcript edits so anchor status never drifts
 * away from the evidence it points at.
 */
export const reverifyClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ClaimWithAnchors[]> => {
    const { supabase, userId } = context;
    await assertReviewRole(context);

    const { data: segmentRows, error: segErr } = await supabase
      .from("transcript_segments")
      .select("id, text")
      .eq("session_id", data.sessionId);
    if (segErr) throw segErr;
    const verifiable: VerifiableSegment[] = ((segmentRows ?? []) as VerifiableSegment[]).map(
      (s) => ({ id: s.id, text: s.text }),
    );

    const { data: claimRows, error: claimErr } = await supabase
      .from("claims")
      .select(CLAIM_SELECT)
      .eq("session_id", data.sessionId);
    if (claimErr) throw claimErr;

    const claims = ((claimRows ?? []) as unknown as RawClaim[]).map(shapeClaim);
    const verifiedAt = new Date().toISOString();
    const updated: ClaimWithAnchors[] = [];

    for (const claim of claims) {
      const quotes = claim.anchors
        .map((a) => a.quote ?? "")
        .filter((q): q is string => q.length > 0);
      // Manual anchors are human decisions and are never re-derived.
      const manual = claim.anchors.filter((a) => a.status === "manual");
      const verdicts = verifyQuotes(quotes, verifiable);
      const derived = deriveSupport([
        ...verdicts,
        ...manual.map((a) => ({
          segmentId: a.segment_id,
          status: "verified" as const,
          score: 1,
          quote: a.quote ?? "",
        })),
      ]);

      await supabase
        .from("claim_anchors")
        .delete()
        .eq("claim_id", claim.id)
        .neq("status", "manual");

      let anchors = manual;
      if (verdicts.length > 0) {
        const { data: anchorRows, error: anchorErr } = await supabase
          .from("claim_anchors")
          .insert(
            verdicts.map((v) => ({
              claim_id: claim.id,
              segment_id: v.segmentId,
              status: v.status,
              quote: v.quote,
              match_score: Number(v.score.toFixed(4)),
              verified_at: verifiedAt,
            })),
          )
          .select("*");
        if (anchorErr) throw anchorErr;
        anchors = [...manual, ...((anchorRows ?? []) as unknown as ClaimAnchorRow[])];
      }

      const { data: claimUpdated, error: updErr } = await supabase
        .from("claims")
        .update({
          support: derived.support,
          confidence: derived.confidence,
          warning: derived.warning ?? null,
        })
        .eq("id", claim.id)
        .select("*")
        .single();
      if (updErr) throw updErr;

      updated.push({ ...(claimUpdated as ClaimRow), anchors });
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: data.sessionId,
      action: "claims.reverified",
      detail: { claims: updated.length },
    });

    return updated;
  });

/**
 * Records a human review decision on a claim. Role-gated server-side, and
 * approval of an unanchored claim requires an explicit manual override plus a
 * reviewer note so the audit trail always records who vouched for it.
 */
export const reviewClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      claimId: string;
      status: ReviewStatus;
      note?: string;
      text?: string;
      manualOverride?: boolean;
    }) =>
      z
        .object({
          claimId: z.string().uuid(),
          status: z.enum(["pending", "approved", "rejected", "uncertain", "needs_more_evidence"]),
          note: z.string().trim().max(2000).optional(),
          text: z.string().trim().min(1).max(1000).optional(),
          manualOverride: z.boolean().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }): Promise<ClaimWithAnchors> => {
    const { supabase, userId } = context;
    await assertReviewRole(context);

    const { data: existing, error: readErr } = await supabase
      .from("claims")
      .select(CLAIM_SELECT)
      .eq("id", data.claimId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!existing) throw new Error("Claim not found.");

    const claim = shapeClaim(existing as unknown as RawClaim);
    const hasAnchor = claim.anchors.some(
      (a) => a.status === "verified" || a.status === "manual",
    );

    if (data.status === "approved" && !hasAnchor) {
      if (!data.manualOverride) {
        throw new Error(
          "This claim has no verified anchor and cannot be approved. Confirm it manually to override.",
        );
      }
      if (!data.note) {
        throw new Error("A reviewer note is required when manually confirming an unanchored claim.");
      }
      // The manual override itself becomes an auditable anchor.
      const { error: manualErr } = await supabase.from("claim_anchors").insert({
        claim_id: claim.id,
        segment_id: claim.anchors[0]?.segment_id ?? null,
        status: "manual",
        quote: data.note,
        match_score: null,
        verified_at: new Date().toISOString(),
      });
      if (manualErr) throw manualErr;
    }

    const { data: updated, error } = await supabase
      .from("claims")
      .update({
        review_status: data.status,
        reviewer_note: data.note ?? claim.reviewer_note,
        text: data.text ?? claim.text,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.claimId)
      .select(CLAIM_SELECT)
      .single();
    if (error) throw error;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      session_id: claim.session_id,
      action: `claim.${data.status}`,
      detail: {
        claim_id: claim.id,
        edited_text: Boolean(data.text),
        manual_override: Boolean(data.status === "approved" && !hasAnchor),
        has_note: Boolean(data.note),
      },
    });

    return shapeClaim(updated as unknown as RawClaim);
  });
