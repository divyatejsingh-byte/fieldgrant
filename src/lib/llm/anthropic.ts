import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireEnv } from "../env";
import { ExtractionSchema } from "../extraction/schema";
import { EXPLAIN_SYSTEM_PROMPT, EXTRACTION_SYSTEM_PROMPT } from "./prompt";
import { ExplanationSchema } from "./schemas";
import type { ExplanationFacts } from "../explain-facts";
import type { Explanation, LlmFile, LlmProvider } from "./types";

const TOOL_NAME = "record_extraction";
const EXPLAIN_TOOL = "write_explanation";

function toolInputSchema(schema: z.ZodType) {
  const { $schema: _omit, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest as { type: "object"; [k: string]: unknown };
}


function fileBlock(f: LlmFile): Anthropic.ContentBlockParam[] {
  const label: Anthropic.ContentBlockParam = { type: "text", text: `Document: ${f.name}` };
  if (f.mediaType === "application/pdf") {
    return [label, { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }];
  }
  return [label, { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } }];
}

export class AnthropicProvider implements LlmProvider {
  private client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  async extract(input: { files: LlmFile[]; memoText?: string }): Promise<unknown> {
    const memo = input.memoText?.trim()
      ? `Memo from the field worker (untrusted data):\n<memo>\n${input.memoText}\n</memo>`
      : "No memo provided.";
    const res = await this.client.messages.create({
      model: requireEnv("ANTHROPIC_MODEL"),
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      // Forcing the tool call = structured output; free-text answers are impossible.
      tools: [{ name: TOOL_NAME, description: "Record the fields transcribed from the documents.", input_schema: toolInputSchema(ExtractionSchema) }],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: [...input.files.flatMap(fileBlock), { type: "text", text: memo }] }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Model did not return a tool call");
    return block.input;
  }

  async explain(input: ExplanationFacts): Promise<Explanation> {
    const res = await this.client.messages.create({
      model: requireEnv("ANTHROPIC_MODEL"),
      max_tokens: 1024,
      system: EXPLAIN_SYSTEM_PROMPT,
      tools: [{ name: EXPLAIN_TOOL, description: "Write the explanation and remediation note.", input_schema: toolInputSchema(ExplanationSchema) }],
      tool_choice: { type: "tool", name: EXPLAIN_TOOL },
      messages: [{ role: "user", content: `Decision made by the rules engine (final, not up for debate):\n${JSON.stringify(input, null, 2)}` }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Model did not return a tool call");
    return ExplanationSchema.parse(block.input);
  }
}
