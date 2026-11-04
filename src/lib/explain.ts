// Step 4 of the pipeline: plain-language explanation of a decision that CODE already made.
// The model sees only ExplanationFacts (see explain-facts.ts). If it is unavailable, returns something unsafe, or the facts
// cannot be built, the deterministic text below is used instead: an explanation can never block or change a decision.
import { buildExplanationFacts, explanationIsSafe, type FactsInput } from "./explain-facts";
import type { Explanation, LlmProvider } from "./llm/types";
import type { CheckResult, Decision } from "./rules/types";

const REASON_TEXT: Record<string, string> = {
  EXTRACTION_RUN_FAILED: "The documents could not be read reliably.",
  EXTRACTION_UNREADABLE_VALUE: "Some amounts or dates on the documents could not be read.",
  RUNS_DISAGREE: "Two independent reads of the documents disagreed on key values.",
  LOW_CONFIDENCE: "The reader was not confident about some values.",
  EMBEDDED_INSTRUCTIONS_DETECTED: "The documents contain text addressed to an automated system, which was ignored.",
  INSTRUCTION_LIKE_TEXT_IN_FIELDS: "Instruction-like text was found in the extracted fields and was ignored.",
  MEMO_INSTRUCTION_LIKE_TEXT: "The memo contains instruction-like text, which was ignored.",
};

/**
 * Deterministic text built only from code-produced check details and fixed reason sentences (never from model output
 * or document text).
 */
export function fallbackExplanation(decision: Decision, checks: CheckResult[], codes: string[] = []): Explanation {
  const failed = checks.filter((c) => !c.passed);
  const head = {
    RELEASE: "All compliance checks passed and the extracted values were consistent across two independent reads, so the tranche is cleared for release.",
    OFFICER_REVIEW: "The submission needs a program officer's review before any funds move.",
    HOLD: "A hard compliance check failed, so the tranche is on hold.",
  }[decision];
  const detail = failed.length ? ` ${failed.map((c) => c.detail).join(" ")}` : "";
  const why = decision === "OFFICER_REVIEW" ? codes.map((c) => REASON_TEXT[c.split(":")[0]]).filter(Boolean) : [];
  return {
    explanation: `${head}${detail}${why.length ? ` ${[...new Set(why)].join(" ")}` : ""}`.trim(),
    remediation_note:
      decision === "RELEASE"
        ? "No action needed."
        : failed.length
          ? `Please address: ${failed.map((c) => c.detail).join(" ")} Then resubmit clear evidence.`
          : "Please resubmit a clearer receipt and roster, or wait for an officer's decision.",
  };
}

export type AuditExplanation = Explanation & { source: "llm" | "fallback"; fallbackReason?: "FACTS_INVALID" | "MODEL_ERROR" | "OUTPUT_REJECTED" };

/** Never throws. */
export async function generateAuditExplanation(llm: LlmProvider, input: FactsInput): Promise<AuditExplanation> {
  const fallback = (fallbackReason: AuditExplanation["fallbackReason"]): AuditExplanation => ({ ...fallbackExplanation(input.decision, input.checks, input.extraction.codes), source: "fallback", fallbackReason });

  let facts;
  try {
    facts = buildExplanationFacts(input);
  } catch {
    return fallback("FACTS_INVALID"); // fail closed: nothing unvalidated is ever sent to a model
  }
  let ex: Explanation;
  try {
    ex = await llm.explain(facts);
  } catch {
    return fallback("MODEL_ERROR");
  }
  if (!explanationIsSafe(input.decision, ex)) return fallback("OUTPUT_REJECTED");
  return { ...ex, source: "llm" };
}
