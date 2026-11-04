import { z } from "zod";

/** Strict: any extra key in the model's reply fails validation, and the caller falls back to deterministic text. */
export const ExplanationSchema = z.object({ explanation: z.string().min(1).max(1200), remediation_note: z.string().min(1).max(1200) }).strict();

/** JSON Schema as text, for providers that take the schema in the prompt instead of a tool definition. */
export function jsonSchemaText(schema: z.ZodType): string {
  const { $schema: _omit, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return JSON.stringify(rest);
}
