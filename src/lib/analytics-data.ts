import type Database from "better-sqlite3";
import { computeFiscalUtilization, type GrantRow, type SubmissionRow, type TrancheRow, type Utilization } from "./analytics";
import { fiscalYearStart, fyLabel } from "./fiscal-year";
import { getFoundation, type Foundation } from "./foundations";

export type UtilizationScope = { foundationId: number; ngoId?: number; year?: number };

export type UtilizationResponse = {
  foundation: Foundation;
  currentStartYear: number;
  years: { startYear: number; label: string }[];
  utilization: Utilization;
};

/**
 * Utilization for ONE funder, always computed in THAT funder's FY model. Optionally narrowed to one NGO's grants
 * from that funder (used by the grantee's per-funder facility cards). `today` is injectable so "current FY" is testable.
 */
export function loadUtilization(db: Database.Database, scope: UtilizationScope, today: Date = new Date()): UtilizationResponse {
  const foundation = getFoundation(db, scope.foundationId);
  if (!foundation) throw new RangeError(`Unknown foundation ${scope.foundationId}`);
  const model = foundation.fyModel;
  const currentStartYear = fiscalYearStart(today, model);
  const active = Number.isInteger(scope.year) ? (scope.year as number) : currentStartYear;

  const ngoClause = scope.ngoId ? " AND g.ngo_id=?" : "";
  const args = scope.ngoId ? [scope.foundationId, scope.ngoId] : [scope.foundationId];

  const grants = db.prepare(`SELECT g.id, g.start_date, g.end_date, g.total_cents FROM grant_award g WHERE g.foundation_id=?${ngoClause}`).all(...args) as GrantRow[];
  const tranches = db
    .prepare(`SELECT t.id, t.grant_id, t.amount_cents, t.status, t.disbursed_at FROM tranche t JOIN grant_award g ON g.id=t.grant_id WHERE g.foundation_id=?${ngoClause}`)
    .all(...args) as TrancheRow[];
  const submissions = db
    .prepare(
      `SELECT s.id, s.tranche_id, s.decision,
              json_extract(s.extracted_final,'$.normalized.dateISO') AS receipt_date,
              json_extract(s.extracted_final,'$.normalized.totalCents') AS receipt_cents
       FROM submission s JOIN tranche t ON t.id=s.tranche_id JOIN grant_award g ON g.id=t.grant_id WHERE g.foundation_id=?${ngoClause}`,
    )
    .all(...args) as SubmissionRow[];

  return {
    foundation,
    currentStartYear,
    years: [currentStartYear - 1, currentStartYear, currentStartYear + 1].map((y) => ({ startYear: y, label: fyLabel(y, model) })),
    utilization: computeFiscalUtilization(grants, tranches, submissions, model, active),
  };
}
