// Fiscal-year capital utilization. PURE: no I/O, no clock. Every amount is integer cents; the only divisions are
// integer divisions (see intDiv), so there is no floating-point drift in money. Percentages are basis points (1/100 of 1%).
import { fiscalYearRange, fyLabel, inFiscalYear, type FYModel } from "./fiscal-year";

export type GrantRow = { id: number; start_date: string; end_date: string; total_cents: number };
export type TrancheRow = { id: number; grant_id: number; amount_cents: number; status: string; disbursed_at: string | null };
export type SubmissionRow = { id: number; tranche_id: number; decision: string | null; receipt_date: string | null; receipt_cents: number | null };

export type Utilization = {
  model: FYModel;
  startYear: number;
  label: string;
  range: { start: string; end: string };
  /** Grant awards pro-rated into this FY. */
  committedCents: number;
  /** Tranches PAID or RELEASING (PayPal payout dispatched) within this FY. */
  disbursedCents: number;
  /** Receipt totals of approved submissions whose receipt date is within this FY. */
  utilizedCents: number;
  /** disbursed - utilized. Negative means approved receipts exist for which the payout has not been dispatched yet. */
  floatCents: number;
  disbursedBps: number | null;
  utilizedBps: number | null;
  /** Non-overlapping bar segments in cents; verified + float = disbursed, unreleased = committed - disbursed (floored at 0). */
  bar: { verifiedCents: number; floatCents: number; unreleasedCents: number; totalCents: number };
};

/** Exact integer division for non-negative safe integers (no float rounding). */
const intDiv = (a: number, b: number) => (a - (a % b)) / b;

/** Proportion in basis points rounded half-up, using integers only. null when the whole is 0. */
export function bps(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return intDiv(2 * part * 10_000 + whole, 2 * whole);
}

const dayNumber = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/**
 * Share of a grant's award that falls inside [fyStart, fyEnd], pro-rated by days.
 * Uses CUMULATIVE rounding (floor of total * daysElapsed / totalDays at each boundary), so the shares of consecutive
 * fiscal years sum to exactly the award: no cent is lost or invented by rounding.
 */
export function committedInFiscalYear(g: GrantRow, fyStart: string, fyEnd: string): number {
  const gs = dayNumber(g.start_date);
  const ge = dayNumber(g.end_date);
  const totalDays = ge - gs + 1;
  if (totalDays <= 0 || g.total_cents <= 0) return 0;
  const cumulative = (lastDay: number) => {
    const elapsed = Math.min(Math.max(lastDay - gs + 1, 0), totalDays);
    return intDiv(g.total_cents * elapsed, totalDays);
  };
  return cumulative(dayNumber(fyEnd)) - cumulative(dayNumber(fyStart) - 1);
}

export function computeFiscalUtilization(
  grants: GrantRow[],
  tranches: TrancheRow[],
  submissions: SubmissionRow[],
  funderModel: FYModel,
  activeYear: number,
): Utilization {
  const range = fiscalYearRange(activeYear, funderModel);

  const committedCents = grants.reduce((sum, g) => sum + committedInFiscalYear(g, range.start, range.end), 0);

  // Disbursed: payout dispatched via PayPal (PAID or RELEASING) with a dispatch date inside the FY.
  const disbursedCents = tranches
    .filter((t) => (t.status === "PAID" || t.status === "RELEASING") && t.disbursed_at && inFiscalYear(t.disbursed_at, activeYear, funderModel))
    .reduce((sum, t) => sum + t.amount_cents, 0);

  // Utilized: only the LATEST approved (RELEASE, incl. officer-approved) submission per tranche counts, so a
  // resubmission can never double-count the same spend. Receipt date (not payout date) decides the FY.
  const latestApproved = new Map<number, SubmissionRow>();
  for (const s of submissions) {
    if (s.decision !== "RELEASE") continue;
    const cur = latestApproved.get(s.tranche_id);
    if (!cur || s.id > cur.id) latestApproved.set(s.tranche_id, s);
  }
  let utilizedCents = 0;
  for (const s of latestApproved.values()) {
    if (s.receipt_cents !== null && s.receipt_cents > 0 && s.receipt_date && inFiscalYear(s.receipt_date, activeYear, funderModel)) utilizedCents += s.receipt_cents;
  }

  const verifiedCents = Math.min(utilizedCents, disbursedCents);
  const floatSegment = Math.max(disbursedCents - utilizedCents, 0);
  const unreleasedCents = Math.max(committedCents - disbursedCents, 0);

  return {
    model: funderModel,
    startYear: activeYear,
    label: fyLabel(activeYear, funderModel),
    range,
    committedCents,
    disbursedCents,
    utilizedCents,
    floatCents: disbursedCents - utilizedCents,
    disbursedBps: bps(disbursedCents, committedCents),
    utilizedBps: bps(utilizedCents, committedCents),
    bar: { verifiedCents, floatCents: floatSegment, unreleasedCents, totalCents: verifiedCents + floatSegment + unreleasedCents },
  };
}
