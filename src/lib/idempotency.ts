import { createHash } from "node:crypto";

/**
 * WHY: a payout must never be sent twice. Both keys are deterministic functions of
 * (grant, tranche, attempt): retrying the same attempt reuses the same keys, so PayPal
 * dedupes it; a genuinely new attempt (after a confirmed failure) bumps `attempt`.
 * sender_batch_id is unique within 30 days on PayPal's side (per the Payouts API spec).
 */
export function senderBatchId(grantId: number, trancheSeq: number, attempt: number): string {
  return `FG-G${grantId}-T${trancheSeq}-A${attempt}`;
}

/** Value for the PayPal-Request-Id header: stable per attempt, opaque, header-safe. */
export function paypalRequestId(grantId: number, trancheSeq: number, attempt: number): string {
  const h = createHash("sha256").update(senderBatchId(grantId, trancheSeq, attempt)).digest("hex");
  return `fg-${h.slice(0, 32)}`;
}
