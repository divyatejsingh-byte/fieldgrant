import { getDb, handle } from "@/lib/api";
import { reviewQueue } from "@/lib/queries";

export const dynamic = "force-dynamic";
/** Optional ?foundation_id= limits the queue to one funder's grants. */
export const GET = (req: Request) =>
  handle(() => {
    const f = Number(new URL(req.url).searchParams.get("foundation_id"));
    return reviewQueue(getDb(), Number.isInteger(f) && f > 0 ? f : undefined);
  });
