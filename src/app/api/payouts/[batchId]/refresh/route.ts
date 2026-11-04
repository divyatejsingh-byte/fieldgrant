import { getDb, handle, livePayPal } from "@/lib/api";
import { PayoutError, refreshBatch } from "@/lib/payout/service";
import { PayPalError } from "@/lib/paypal/client";
import { payoutInspector } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** "Poll PayPal now": re-reads the batch from the sandbox (the polling fallback) and returns the updated inspector view. */
export const POST = (_: Request, { params }: { params: Promise<{ batchId: string }> }) =>
  handle(async () => {
    const db = getDb();
    const batchId = (await params).batchId;
    if (!payoutInspector(db, batchId)) throw new PayoutError("No payout batch with that id was created by this app.", 404);
    try {
      await refreshBatch(db, livePayPal, batchId);
    } catch (e) {
      throw new PayoutError(e instanceof PayPalError ? e.message : "Could not reach PayPal.", 502);
    }
    return payoutInspector(db, batchId);
  });
