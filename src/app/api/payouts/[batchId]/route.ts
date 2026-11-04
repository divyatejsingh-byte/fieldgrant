import { getDb, handle } from "@/lib/api";
import { PayoutError } from "@/lib/payout/service";
import { payoutInspector } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Read-only detail of one payout batch for the PayPal Rail Inspector drawer. */
export const GET = (_: Request, { params }: { params: Promise<{ batchId: string }> }) =>
  handle(async () => {
    const d = payoutInspector(getDb(), (await params).batchId);
    if (!d) throw new PayoutError("No payout batch with that id was created by this app.", 404);
    return d;
  });
