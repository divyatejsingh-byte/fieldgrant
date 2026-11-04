import { z } from "zod";

// Strict schema for what the model may return. Everything is a short, bounded string/number:
// WHY: long free text in a field is a prompt-injection smell, so .max() lengths double as a tripwire.
// Anything that fails this schema is routed to OFFICER_REVIEW by the pipeline (Phase 1).
const short = z.string().max(200);
const conf = z.number().min(0).max(1);

export const LineItemSchema = z.object({
  description: short,
  quantity: z.number().nonnegative().max(1e7).nullable(), // a count, never a currency amount
  unit_price_text: short.nullable(), // amounts stay as printed; code converts to cents (money.ts)
  amount_text: short.nullable(),
});

export const ExtractionSchema = z
  .object({
    vendor_name: short.nullable(),
    receipt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").nullable(),
    total_text: short.nullable(), // as printed on the receipt, e.g. "$2,740.00"
    line_items: z.array(LineItemSchema).max(100),
    attendee_count: z.number().int().nonnegative().nullable(), // number of distinct names on the roster
    // Verbatim transcription of the receipt text around totals; used by the independent regex check.
    receipt_transcription: z.string().max(4000),
    // The model flags (does NOT obey) text in the documents that tries to instruct an AI/system.
    embedded_instructions_detected: z.boolean(),
    embedded_instructions_quote: z.string().max(300).nullable(),
    field_confidence: z.object({
      vendor: conf,
      date: conf,
      total: conf,
      attendees: conf,
      line_items: conf,
    }),
  })
  .strict();

/** The one shape the model may return. Anything else (extra keys, wrong types, long text) fails validation. */
export const ExtractedSubmissionSchema = ExtractionSchema;
export type Extraction = z.infer<typeof ExtractionSchema>;
