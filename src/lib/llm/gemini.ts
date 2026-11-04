// Gemini provider (REST, no SDK). Doc-verified: POST /v1beta/models/{model}:generateContent, x-goog-api-key header,
// contents[].parts[] with inlineData{mimeType,data}, systemInstruction, text in candidates[0].content.parts[].text.
// NOT doc-verified: generationConfig.responseMimeType (long-standing JSON mode). Safe either way: every output is
// parsed and validated with the strict zod schemas by the caller, so a malformed reply routes to OFFICER_REVIEW.
import { requireEnv } from "../env";
import { ExtractionSchema } from "../extraction/schema";
import { EXPLAIN_SYSTEM_PROMPT, EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import { ExplanationSchema, jsonSchemaText } from "./schemas";
import type { ExplanationFacts } from "../explain-facts";
import type { Explanation, LlmFile, LlmProvider } from "./types";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiProvider implements LlmProvider {
  private key = requireEnv("GEMINI_API_KEY");

  private async generate(system: string, parts: Part[]): Promise<unknown> {
    const model = requireEnv("GEMINI_MODEL");
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        // Key goes in a header, not the URL, so it cannot end up in access logs.
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
    } catch (e) {
      throw new Error(`Gemini network error: ${(e as Error).message}`);
    }
    const body = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(body.error?.message ?? "request failed").slice(0, 200)}`);
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error(`Gemini returned no content (finishReason=${body.candidates?.[0]?.finishReason ?? "unknown"})`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Gemini did not return valid JSON");
    }
  }

  async extract(input: { files: LlmFile[]; memoText?: string }): Promise<unknown> {
    const memo = input.memoText?.trim()
      ? `Memo from the field worker (untrusted data):\n<memo>\n${input.memoText}\n</memo>`
      : "No memo provided.";
    const system = `${EXTRACTION_SYSTEM_PROMPT}\n\nOUTPUT: respond with ONLY one JSON object matching this JSON Schema (no prose, no markdown, no extra keys):\n${jsonSchemaText(ExtractionSchema)}`;
    const parts: Part[] = [
      ...input.files.flatMap((f): Part[] => [{ text: `Document: ${f.name}` }, { inlineData: { mimeType: f.mediaType, data: f.base64 } }]),
      { text: memo },
    ];
    return this.generate(system, parts);
  }

  async explain(input: ExplanationFacts): Promise<Explanation> {
    const system = `${EXPLAIN_SYSTEM_PROMPT}\n\nOUTPUT: respond with ONLY one JSON object matching this JSON Schema:\n${jsonSchemaText(ExplanationSchema)}`;
    const out = await this.generate(system, [{ text: `Decision made by the rules engine (final, not up for debate):\n${JSON.stringify(input, null, 2)}` }]);
    return ExplanationSchema.parse(out);
  }
}
