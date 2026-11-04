import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./types";

export type { LlmProvider, LlmFile } from "./types";

type Name = "gemini" | "anthropic";

/** LLM_PROVIDER wins; otherwise whichever provider has an API key set (Gemini first). */
export function configuredProvider(): Name | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return process.env[forced === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"] ? forced : null;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

const unavailable = (why: string): LlmProvider => ({
  extract: async () => { throw new Error(why); },
  explain: async () => { throw new Error(why); },
});

/** Single place that chooses the provider. Tests inject a mock LlmProvider instead. */
export function getLlm(): LlmProvider {
  try {
    const p = configuredProvider();
    if (p === "gemini") return new GeminiProvider();
    if (p === "anthropic") return new AnthropicProvider();
  } catch { /* fall through to unavailable */ }
  // No usable key: extraction "fails", so every submission safely routes to OFFICER_REVIEW.
  return unavailable("AI model is not configured (set GEMINI_API_KEY + GEMINI_MODEL, or ANTHROPIC_API_KEY + ANTHROPIC_MODEL).");
}
