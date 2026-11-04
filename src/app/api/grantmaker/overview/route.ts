import { getDb, handle } from "@/lib/api";
import { getFoundation } from "@/lib/foundations";
import { PayoutError } from "@/lib/payout/service";
import { loadGrantmakerOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  handle(() => {
    const q = new URL(req.url).searchParams;
    const fid = Number(q.get("foundation_id"));
    if (!Number.isInteger(fid) || !getFoundation(getDb(), fid)) throw new PayoutError("A valid foundation_id is required.", 400);
    const y = Number(q.get("year"));
    return loadGrantmakerOverview(getDb(), fid, Number.isInteger(y) && y >= 1900 && y <= 2200 ? y : undefined);
  });
