import { MoneyParseError, parseMoneyToCents } from "../money";
import type { NormalizedExtraction } from "../rules/types";
import type { Extraction } from "./schema";

const vendorKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function cents(text: string | null, problems: string[], what: string): number | null {
  if (text === null) return null;
  try {
    return parseMoneyToCents(text);
  } catch (e) {
    if (e instanceof MoneyParseError) problems.push(`${what} "${text.slice(0, 40)}" is not a readable amount`);
    else throw e;
    return null;
  }
}

/** Converts model output (amounts as printed) into integer cents. Unparseable amounts are reported as problems. */
export function normalizeExtraction(e: Extraction): { value: NormalizedExtraction; problems: string[] } {
  const problems: string[] = [];
  const value: NormalizedExtraction = {
    vendor: e.vendor_name,
    vendorKey: e.vendor_name ? vendorKey(e.vendor_name) || null : null,
    dateISO: e.receipt_date && !Number.isNaN(Date.parse(e.receipt_date)) ? e.receipt_date : null,
    totalCents: cents(e.total_text, problems, "total"),
    lineItems: e.line_items.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitCents: cents(li.unit_price_text, problems, "unit price"),
      amountCents: cents(li.amount_text, problems, "line amount"),
    })),
    attendeeCount: e.attendee_count,
    transcription: e.receipt_transcription,
  };
  if (e.receipt_date && value.dateISO === null) problems.push("receipt date is not a valid date");
  return { value, problems };
}
