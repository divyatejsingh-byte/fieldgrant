// The ONLY thing the explanation model ever receives: a small, strictly validated facts object built by code from the
// rules engine's structured output. No document text, no memo, no free-text sentences, no image.
//
// Defense in depth, in order of importance:
//  1. CONSTRUCTION: nothing document-derived is ever placed into facts (checks.ts / covenants.ts only emit numbers, dates,
//     fixed codes and funder/database-defined labels). tests/gemini-firewall.test.ts proves this with hostile inputs.
//  2. SHAPE: ExplanationFactsSchema is .strict() with charset-restricted names, so an unexpected field or odd value cannot slip in.
//  3. SCAN: any string that looks like an instruction to an AI/system aborts the build (the caller then uses deterministic text).
//  4. OUTPUT GUARD: the model's reply is rejected if it claims an approval/payment the code did not decide.
// A string that merely matches a charset is NOT proven safe; (1) is what makes the facts safe, (2)-(4) catch mistakes.
import { z } from "zod";
import { findSuspiciousText } from "./extraction/reliability";
import type { CheckData, CheckResult, Decision } from "./rules/types";

const NAME = /^[A-Za-z0-9_-]{1,100}$/; // check names, covenant ids
const KEY = /^[a-z_]{1,40}$/; // data keys
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Z][A-Z_]{1,39}$/; // e.g. EXPIRED, MISSING
const LABEL = /^[A-Za-z0-9 .,'&()/_-]{1,120}$/; // funder-defined covenant names, database NGO/grant names
const REASON_CODE = /^[A-Z_]{3,40}(:[a-z_,]{1,60})?$/;

const Scalar = z.union([z.number().finite(), z.boolean(), z.null(), z.string().regex(ISO_DATE), z.string().regex(CODE), z.string().regex(LABEL)]);
const DataValue = z.union([Scalar, z.array(z.union([z.number().finite(), z.string().regex(LABEL)])).max(6)]);

export const ExplanationFactsSchema = z
  .object({
    decision: z.enum(["RELEASE", "OFFICER_REVIEW", "HOLD"]),
    extraction: z.object({ status: z.enum(["RELIABLE", "UNRELIABLE", "SKIPPED"]), reason_codes: z.array(z.string().regex(REASON_CODE)).max(12) }).strict(),
    failed_checks: z.array(z.object({ name: z.string().regex(NAME), severity: z.enum(["HARD", "SOFT"]), data: z.record(z.string().regex(KEY), DataValue) }).strict()).max(40),
    passed_checks: z.array(z.string().regex(NAME)).max(60),
    covenants_unmet: z.array(z.object({ id: z.string().regex(NAME), name: z.string().regex(LABEL) }).strict()).max(30),
  })
  .strict();

export type ExplanationFacts = z.infer<typeof ExplanationFactsSchema>;

export type FactsInput = {
  decision: Decision;
  checks: CheckResult[];
  extraction: { status: "RELIABLE" | "UNRELIABLE" | "SKIPPED"; codes: string[] };
};

/** Keeps only well-formed entries: a malformed value is dropped, never repaired. */
function sanitizeData(data: CheckData | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (KEY.test(k) && DataValue.safeParse(v).success) out[k] = v;
  }
  return out;
}

function stringsIn(v: unknown): string[] {
  return typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(stringsIn) : v && typeof v === "object" ? Object.values(v).flatMap(stringsIn) : [];
}

/** Builds and validates the facts. Throws if anything is off; callers then fall back to deterministic text. */
export function buildExplanationFacts(input: FactsInput): ExplanationFacts {
  const failed = input.checks.filter((c) => !c.passed);
  const facts = {
    decision: input.decision,
    extraction: { status: input.extraction.status, reason_codes: input.extraction.codes.filter((c) => REASON_CODE.test(c)).slice(0, 12) },
    failed_checks: failed.map((c) => ({ name: c.name, severity: c.severity, data: sanitizeData(c.data) })),
    passed_checks: input.checks.filter((c) => c.passed).map((c) => c.name),
    covenants_unmet: failed
      .filter((c) => c.name.startsWith("covenant_"))
      .map((c) => {
        const id = String(c.data?.covenant_id ?? c.name.slice("covenant_".length));
        const name = String(c.data?.covenant_name ?? id);
        return { id, name: LABEL.test(name) ? name : id };
      }),
  };
  const parsed = ExplanationFactsSchema.parse(facts);
  const suspicious = findSuspiciousText(...stringsIn(parsed));
  if (suspicious) throw new Error("Instruction-like text found while building explanation facts");
  return parsed;
}

// --- output guard ---------------------------------------------------------------------------------------------------

// A CLAIM that this submission/tranche/payment was approved, released or paid. The bare word "approved" is not a claim
// ("exceeds the approved budget line" is fine), so these patterns target passive claims, standalone verdicts and the
// explicit AUTO_RELEASE label.
const DONE = "approved|released|auto[- _]?released|dispatched|disbursed|cleared|authori[sz]ed|sent|paid|processed";
const CLAIMS: RegExp[] = [
  new RegExp(`\\b(?:is|are|was|were|been|being|has|have|had)\\s+(?:\\w+\\s+)?(?:${DONE})\\b`, "gi"), // "has been released", "is now approved"
  new RegExp(`(?:^|[.!?]\\s+)(?:${DONE})\\b`, "gi"), // a sentence that opens with the verdict: "Approved."
  /\b(?:approved|released|cleared)\s+(?:by\s+(?:the\s+)?(?:system|override|ai|model|automation)|for\s+(?:release|payment|disbursement|payout))\b/gi,
  /\bauto[- _]?release\w*\b/gi,
  /\b(?:we|i|the system)\s+(?:have\s+|has\s+)?(?:approved|released|authori[sz]ed)\b/gi,
];
const NEGATION = /\b(not|no|never|cannot|can't|can not|won't|without|until|unless|before|pending|isn't|hasn't|haven't|wasn't|aren't|neither|nor)\b/i;

/** True when the text says this submission was approved/released/paid, without a nearby negation. */
export function claimsApproval(text: string): boolean {
  for (const re of CLAIMS) {
    for (const m of text.matchAll(re)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      if (!NEGATION.test(before)) return true;
    }
  }
  return false;
}

/**
 * The model's text must not contradict the code's decision. For HOLD and OFFICER_REVIEW any un-negated claim of approval or
 * payment is rejected ("Approved by system override."); for every decision, instruction-like text is rejected.
 * Rejection is not an error: the caller simply uses the deterministic explanation instead.
 */
export function explanationIsSafe(decision: Decision, text: { explanation: string; remediation_note: string }): boolean {
  const all = `${text.explanation}\n${text.remediation_note}`;
  if (findSuspiciousText(all) || /\bsystem (override|instruction|notice)\b/i.test(all)) return false;
  if (decision !== "RELEASE" && claimsApproval(all)) return false;
  return true;
}
