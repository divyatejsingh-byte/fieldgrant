// Test fixtures: the demo NGO's tranche 2 and a clean receipt that should pass every check.
import type { Extraction } from "../extraction/schema";
import type { RulesContext } from "./types";

export function baseContext(over: Partial<RulesContext> = {}): RulesContext {
  return {
    extraction: {
      vendor: "Greenfield Training Supplies",
      vendorKey: "greenfield training supplies",
      dateISO: "2026-10-14",
      totalCents: 250_000,
      lineItems: [
        { description: "Training kit set", quantity: 50, unitCents: 4600, amountCents: 230_000 },
        { description: "Delivery and packaging", quantity: 1, unitCents: 20_000, amountCents: 20_000 },
      ],
      attendeeCount: 50,
      transcription: "Subtotal $2,500.00\nTOTAL $2,500.00",
    },
    requirements: { required_attendees: 50, budget_line_label: "Training kits", budget_line_cents: 250_000, tolerance_pct: 10 },
    grant: { start_date: "2026-01-01", end_date: "2026-12-31", spend_cap_cents: 1_000_000 },
    trancheAmountCents: 500_000,
    committedCents: 250_000,
    fileHashDuplicates: [],
    vendorDateAmountDuplicates: [],
    priorVendorPrices: [],
    ...over,
  };
}

/** A clean model output matching baseContext. */
export function cleanRawExtraction(over: Partial<Extraction> = {}): Extraction {
  return {
    vendor_name: "Greenfield Training Supplies",
    receipt_date: "2026-10-14",
    total_text: "$2,500.00",
    line_items: [
      { description: "Training kit set", quantity: 50, unit_price_text: "$46.00", amount_text: "$2,300.00" },
      { description: "Delivery and packaging", quantity: 1, unit_price_text: "$200.00", amount_text: "$200.00" },
    ],
    attendee_count: 50,
    receipt_transcription: "Subtotal $2,500.00\nTOTAL $2,500.00",
    embedded_instructions_detected: false,
    embedded_instructions_quote: null,
    field_confidence: { vendor: 0.98, date: 0.97, total: 0.99, attendees: 0.95, line_items: 0.96 },
    ...over,
  };
}
