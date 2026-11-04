import { getDb, handle, livePayPal } from "@/lib/api";
import { overrideDecision, PayoutError } from "@/lib/payout/service";

export const dynamic = "force-dynamic";
export const POST = (req: Request) =>
  handle(async () => {
    const b = (await req.json().catch(() => ({}))) as { submissionId?: number; newDecision?: string; reason?: string };
    if (!Number.isInteger(b.submissionId) || !["RELEASE", "HOLD"].includes(b.newDecision ?? "")) throw new PayoutError("submissionId and newDecision (RELEASE or HOLD) are required.", 400);
    return overrideDecision(getDb(), livePayPal, { submissionId: b.submissionId as number, newDecision: b.newDecision as "RELEASE" | "HOLD", reason: b.reason ?? "" });
  });
