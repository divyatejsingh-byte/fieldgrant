import { getDb, handle } from "@/lib/api";
import { grantCompliance } from "@/lib/compliance";
import { PayoutError } from "@/lib/payout/service";

export const dynamic = "force-dynamic";

/** A grant's covenants against the grantee vault, with the location-aware preset for the editor. */
export const GET = (_: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const c = grantCompliance(getDb(), Number((await params).id));
    if (!c) throw new PayoutError("Grant not found", 404);
    const { evaluation: _e, vault: _v, ...rest } = c;
    return { ...rest, passed: _e.passed, blockingOutstanding: _e.blockingFailures.length };
  });
