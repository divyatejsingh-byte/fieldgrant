// Sends ONE small SANDBOX payout to NGO1_PAYPAL_EMAIL and polls its status.
// Usage: npm run test:payout
import { randomBytes } from "node:crypto";
import { loadEnv, requireEnv } from "../src/lib/env";
loadEnv();
import { createPayout, getPayoutBatch, PayPalError } from "../src/lib/paypal/client";
import { senderBatchId, paypalRequestId } from "../src/lib/idempotency";

const AMOUNT_CENTS = 100; // $1.00 USD, sandbox

async function main() {
  const receiver = requireEnv("NGO1_PAYPAL_EMAIL");
  requireEnv("PAYPAL_CLIENT_ID");
  requireEnv("PAYPAL_CLIENT_SECRET");

  // Random "attempt" so repeated manual test runs don't collide (sender_batch_id must be unique for 30 days).
  const attempt = parseInt(randomBytes(3).toString("hex"), 16);
  const batchId = senderBatchId(0, 0, attempt);
  console.log(`Creating $1.00 sandbox payout to ${receiver} (sender_batch_id=${batchId}) ...`);

  const created = await createPayout({
    senderBatchId: batchId,
    requestId: paypalRequestId(0, 0, attempt),
    receiverEmail: receiver,
    amountCents: AMOUNT_CENTS,
    senderItemId: `${batchId}-I1`,
    note: "FieldGrant phase-0 sandbox test payout",
  });
  console.log(`Created. payout_batch_id=${created.payoutBatchId} batch_status=${created.batchStatus}`);

  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const d = await getPayoutBatch(created.payoutBatchId);
    console.log(`poll ${i + 1}: batch=${d.batchStatus} items=${d.items.map((x) => `${x.payoutItemId}:${x.transactionStatus}`).join(",") || "-"}`);
    if (!["PENDING", "PROCESSING"].includes(d.batchStatus)) break;
  }
  console.log("Now check the sandbox recipient account at sandbox.paypal.com for the $1.00 payment.");
}

main().catch((e) => {
  if (e instanceof PayPalError) console.error(`PayPal ${e.kind}${e.code ? ` (${e.code})` : ""}: ${e.message}`);
  else console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
});
