import type Database from "better-sqlite3";
import type { VerifyFn } from "../paypal/webhook";
import { applyBatchDetails, refreshBatch, type PayPalApi } from "./service";

const ITEM_STATUS: Record<string, string> = {
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "SUCCESS",
  "PAYMENT.PAYOUTS-ITEM.FAILED": "FAILED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED": "BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.CANCELED": "CANCELED",
  "PAYMENT.PAYOUTS-ITEM.HELD": "ONHOLD",
  "PAYMENT.PAYOUTS-ITEM.REFUNDED": "REFUNDED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED": "RETURNED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "UNCLAIMED",
};

/** Verifies FIRST; an unverifiable payload gets 401 and is never parsed for business logic. */
export async function handlePayPalWebhook(
  db: Database.Database, pp: PayPalApi, verify: VerifyFn, headers: Headers, rawBody: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!(await verify(headers, rawBody))) return { status: 401, body: { error: "Webhook signature could not be verified." } };

  let event: { id?: string; event_type?: string; resource?: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { event = JSON.parse(rawBody); } catch { return { status: 400, body: { error: "Invalid JSON" } }; }
  const type = event.event_type ?? "";
  const r = event.resource ?? {};
  const batchId: string | undefined = r.payout_batch_id ?? r.batch_header?.payout_batch_id;
  if (!batchId || !type.startsWith("PAYMENT.PAYOUTS")) return { status: 200, body: { ignored: true } };

  // PayPal retries deliveries: de-duplicate by event id so replays never double-write.
  if (event.id && db.prepare("SELECT 1 FROM ledger_entry WHERE json_extract(payload,'$.webhook_event_id')=?").get(event.id))
    return { status: 200, body: { duplicate: true } };

  if (type in ITEM_STATUS) {
    const status = String(r.transaction_status ?? ITEM_STATUS[type]);
    applyBatchDetails(db, batchId, { batchStatus: status, items: [{ payoutItemId: String(r.payout_item_id ?? ""), transactionStatus: status }] }, "WEBHOOK", { webhook_event_id: event.id, webhook_event_type: type });
  } else {
    // Batch-level events carry no item detail: re-read the batch from PayPal instead of guessing.
    await refreshBatch(db, pp, batchId, "WEBHOOK").catch(() => undefined);
  }
  return { status: 200, body: { ok: true } };
}
