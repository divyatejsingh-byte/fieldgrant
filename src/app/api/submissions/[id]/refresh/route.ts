import { getDb, handle, livePayPal } from "@/lib/api";
import { PayoutError, refreshBatch } from "@/lib/payout/service";
import { PayPalError } from "@/lib/paypal/client";
import { submissionDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";
/** Manual "Refresh status" button: re-reads the payout batch from PayPal (the polling/webhook fallback). */
export const POST = (_: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const db = getDb();
    const id = Number((await params).id);
    const d = submissionDetail(db, id);
    if (!d?.payout) throw new PayoutError("No payout has been created for this submission yet.", 404);
    try {
      await refreshBatch(db, livePayPal, d.payout.batchId);
    } catch (e) {
      throw new PayoutError(e instanceof PayPalError ? e.message : "Could not reach PayPal.", 502);
    }
    return submissionDetail(db, id);
  });
