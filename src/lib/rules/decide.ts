import type { CheckResult, Decision, Reliability } from "./types";

// These HARD checks do not read anything the model extracted (file hash, DB totals), so a blurry or
// manipulated receipt cannot cause or hide them. They always produce HOLD.
const EXTRACTION_INDEPENDENT = new Set(["duplicate_file_hash", "spend_cap_not_exceeded"]);
// Gate 1 compliance covenants read the grantee vault, never the documents, so they are independent too.
const isIndependent = (name: string) => EXTRACTION_INDEPENDENT.has(name) || name.startsWith("covenant_");

/**
 * THE decision function. Pure code; the LLM has no input into it.
 *
 * Precedence (most restrictive wins, nothing is ever auto-released on doubt):
 *  1. HARD failure on an extraction-independent check            -> HOLD
 *  2. extraction unreliable (disagreement, low confidence, failed
 *     validation, suspicious/injected text)                      -> OFFICER_REVIEW
 *     (HARD failures computed from unreliable data are shown to the officer, not auto-held,
 *      because a misread number must not wrongly hold a legitimate NGO's money)
 *  3. any other HARD failure                                     -> HOLD
 *  4. any SOFT failure                                           -> OFFICER_REVIEW
 *  5. otherwise                                                  -> RELEASE
 */
export function decide(checks: CheckResult[], extraction: Reliability): { decision: Decision; reasons: string[] } {
  const failed = checks.filter((c) => !c.passed);
  const hard = failed.filter((c) => c.severity === "HARD");
  const soft = failed.filter((c) => c.severity === "SOFT");
  const fmt = (c: CheckResult) => `${c.name}: ${c.detail}`;

  const hardIndependent = hard.filter((c) => isIndependent(c.name));
  if (hardIndependent.length > 0) return { decision: "HOLD", reasons: hard.map(fmt) };

  if (!extraction.reliable) {
    return { decision: "OFFICER_REVIEW", reasons: [...extraction.reasons, ...hard.map(fmt), ...soft.map(fmt)] };
  }
  if (hard.length > 0) return { decision: "HOLD", reasons: hard.map(fmt) };
  if (soft.length > 0) return { decision: "OFFICER_REVIEW", reasons: soft.map(fmt) };
  return { decision: "RELEASE", reasons: ["All checks passed and extraction is reliable."] };
}
