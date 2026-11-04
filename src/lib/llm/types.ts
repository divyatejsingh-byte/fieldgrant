// The only surface the rest of the app sees. Swap providers by implementing LlmProvider.
import type { ExplanationFacts } from "../explain-facts";

export type LlmFile = { name: string; mediaType: "application/pdf" | "image/png" | "image/jpeg"; base64: string };

export type Explanation = { explanation: string; remediation_note: string };

export interface LlmProvider {
  /** Returns the RAW (unvalidated) tool-call JSON. Callers must validate with zod; never trust it. */
  extract(input: { files: LlmFile[]; memoText?: string }): Promise<unknown>;
  /** Receives ONLY validated ExplanationFacts built by code: never document text, images or free-text sentences. */
  explain(facts: ExplanationFacts): Promise<Explanation>;
}
