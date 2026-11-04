export type Severity = "HARD" | "SOFT";
export type Decision = "RELEASE" | "OFFICER_REVIEW" | "HOLD";

/**
 * Structured, numbers-and-dates-only facts about a check. This (not `detail`) is what the explanation step sees.
 * Values are validated again by ExplanationFactsSchema before they can reach any model.
 */
export type CheckData = Record<string, number | string | boolean | null | Array<number | string>>;

export type CheckResult = { name: string; passed: boolean; severity: Severity; detail: string; data?: CheckData };

export type Requirements = {
  required_attendees: number;
  budget_line_label: string;
  budget_line_cents: number;
  tolerance_pct: number;
};

export type NormalizedLineItem = {
  description: string;
  quantity: number | null;
  unitCents: number | null;
  amountCents: number | null;
};

/** Extraction after code-side normalization (amounts are integer cents; the model never does this). */
export type NormalizedExtraction = {
  vendor: string | null;
  vendorKey: string | null; // lowercased, punctuation stripped, for duplicate matching
  dateISO: string | null;
  totalCents: number | null;
  lineItems: NormalizedLineItem[];
  attendeeCount: number | null;
  transcription: string;
};

export type DuplicateRef = { submissionId: number; ngoName: string; grantName: string };

export type PriorPrice = { description: string; unitCents: number };

/** Everything the pure checks need. The caller (pipeline) loads it from the DB; checks do no I/O. */
export type RulesContext = {
  extraction: NormalizedExtraction;
  requirements: Requirements;
  grant: { start_date: string; end_date: string; spend_cap_cents: number };
  trancheAmountCents: number;
  /** Cents already paid or in flight (RELEASING/PAID) for this grant, excluding this tranche. */
  committedCents: number;
  fileHashDuplicates: DuplicateRef[];
  vendorDateAmountDuplicates: DuplicateRef[];
  priorVendorPrices: PriorPrice[];
};

export type Reliability = {
  reliable: boolean;
  /** Human-readable reasons for the officer UI. May quote document-derived values: never sent to a model. */
  reasons: string[];
  /** Fixed-vocabulary reason codes (no free text): the only form of these reasons a model may see. */
  codes?: string[];
};
