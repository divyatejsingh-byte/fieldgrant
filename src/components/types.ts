export type Check = { name: string; passed: boolean; severity: "HARD" | "SOFT"; detail: string };
export type Band = "RELEASE" | "OFFICER_REVIEW" | "HOLD";

export type SubmissionDetail = {
  id: number;
  createdAt: string;
  ngo: { id: number; name: string; countryCode: string };
  funderFyModel: "CALENDAR" | "APRIL_MARCH" | "JULY_JUNE" | "OCTOBER_SEPTEMBER";
  grant: { id: number; name: string; start_date: string; end_date: string };
  tranche: {
    id: number;
    seq: number;
    amount_cents: number;
    status: string;
    requirements: { required_attendees: number; budget_line_label: string; budget_line_cents: number; tolerance_pct: number };
  };
  extracted: {
    vendor: string | null;
    dateISO: string | null;
    totalCents: number | null;
    attendeeCount: number | null;
    lineItems: { description: string; quantity: number | null; unitCents: number | null; amountCents: number | null }[];
  } | null;
  reliability: { reliable: boolean; reasons: string[] } | null;
  consensus: import("@/lib/consensus").Consensus;
  checks: Check[];
  /** True when Gate 1 (compliance covenants) stopped the submission before any document was read. */
  extractionSkipped: boolean;
  covenants: { id: string; name: string; category: "STATUTORY" | "GOVERNANCE" | "CUSTOM"; isCustom: boolean; blocking?: boolean }[];
  decision: Band | null;
  explanation: string | null;
  remediation: string | null;
  payout: { batchId: string; itemId: string | null; status: string | null } | null;
  ledger: { id: number; event_type: string; actor: string; status: string | null; created_at: string; payload: Record<string, any> }[]; // eslint-disable-line @typescript-eslint/no-explicit-any
};
