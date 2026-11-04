import type Database from "better-sqlite3";

export type LedgerInput = {
  ngoId: number;
  grantId: number;
  trancheId: number;
  submissionId?: number | null;
  eventType: string;
  actor: "SYSTEM" | "OFFICER" | "WEBHOOK";
  payload?: unknown;
  payoutBatchId?: string | null;
  payoutItemId?: string | null;
  status?: string | null;
};

/** Append-only audit log. Nothing in the app updates or deletes ledger rows (except the demo reset). */
export function writeLedger(db: Database.Database, e: LedgerInput): number {
  return Number(
    db
      .prepare(
        `INSERT INTO ledger_entry (ngo_id, grant_id, tranche_id, submission_id, event_type, actor, payload, payout_batch_id, payout_item_id, status, is_seeded)
         VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
      )
      .run(e.ngoId, e.grantId, e.trancheId, e.submissionId ?? null, e.eventType, e.actor, JSON.stringify(e.payload ?? {}), e.payoutBatchId ?? null, e.payoutItemId ?? null, e.status ?? null)
      .lastInsertRowid,
  );
}
