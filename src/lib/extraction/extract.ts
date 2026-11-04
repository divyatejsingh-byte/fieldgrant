// Step 1 of the pipeline: OCR and structured entity extraction. The model's output is a CLAIM about the documents, never a
// decision. Every claim is validated against a strict schema and normalized to integer cents by code.
import type { LlmFile, LlmProvider } from "../llm/types";
import { normalizeExtraction } from "./normalize";
import type { RunOutcome } from "./reliability";
import { ExtractedSubmissionSchema } from "./schema";

/**
 * One extraction pass. There is deliberately NO retry: a call that errors or returns an invalid shape (extra keys,
 * wrong types, over-long text, conversational output) is recorded as a failed pass, which makes the extraction UNRELIABLE
 * and routes the submission to OFFICER_REVIEW. Retrying blindly would let a hostile document "try again" until it passes.
 */
export async function extractSubmissionEvidence(llm: LlmProvider, files: LlmFile[], memoText?: string): Promise<RunOutcome> {
  let raw: unknown;
  try {
    raw = await llm.extract({ files, memoText });
  } catch (e) {
    return { problems: [], failed: `model call failed: ${(e as Error).message.slice(0, 120)}` };
  }
  const parsed = ExtractedSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    // Report the failure by code and (sanitized) path only; the message text can echo model-chosen strings.
    const i = parsed.error.issues[0];
    const where = (i?.path ?? []).join(".").replace(/[^A-Za-z0-9_.[\]-]/g, "").slice(0, 60);
    return { problems: [], failed: `output failed schema validation (${i?.code ?? "invalid"}${where ? ` at ${where}` : ""})` };
  }
  const { value, problems } = normalizeExtraction(parsed.data);
  return { raw: parsed.data, norm: value, problems };
}

/** Dual-pass consensus: two independent calls over the same documents. Comparing them is done in code (reliability.ts). */
export function extractDualPass(llm: LlmProvider, files: LlmFile[], memoText?: string): Promise<[RunOutcome, RunOutcome]> {
  return Promise.all([extractSubmissionEvidence(llm, files, memoText), extractSubmissionEvidence(llm, files, memoText)]);
}
