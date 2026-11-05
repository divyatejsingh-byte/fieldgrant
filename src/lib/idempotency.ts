import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

/**
 * WHY: a payout must never be sent twice. Both keys are deterministic functions of
 * (grant, tranche, attempt, epoch): retrying the same attempt reuses the same keys, so PayPal
 * dedupes it; a genuinely new attempt (after a confirmed failure) bumps `attempt`.
 *
 * The EPOCH is a short random tag stored with the database and renewed whenever the demo data is reset or reseeded
 * (e.g. every restart on a free Render instance). PayPal remembers every sender_batch_id for 30 days and rejects a repeat with
 * USER_BUSINESS_ERROR ("Batch with given sender_batch_id already exists"), so after a reset the attempt counter would
 * otherwise reuse an id PayPal has already seen. Within one database lifetime the keys stay stable, so retries stay safe.
 */
export function senderBatchId(grantId: number, trancheSeq: number, attempt: number, epoch?: string | null): string {
  return `FG-G${grantId}-T${trancheSeq}-A${attempt}${epoch ? `-${epoch}` : ""}`;
}

/** Value for the PayPal-Request-Id header: stable per sender_batch_id, opaque, header-safe. */
export function requestIdForBatch(senderBatch: string): string {
  return `fg-${createHash("sha256").update(senderBatch).digest("hex").slice(0, 32)}`;
}

export function paypalRequestId(grantId: number, trancheSeq: number, attempt: number, epoch?: string | null): string {
  return requestIdForBatch(senderBatchId(grantId, trancheSeq, attempt, epoch));
}

/** The current epoch of this database (null on a database seeded before epochs existed: ids keep the old format). */
export function payoutEpoch(db: Database.Database): string | null {
  const r = db.prepare("SELECT value FROM app_meta WHERE key='payout_epoch'").get() as { value: string } | undefined;
  return r?.value ?? null;
}
