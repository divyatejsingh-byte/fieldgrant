import { getDb, handle } from "@/lib/api";
import { PayoutError } from "@/lib/payout/service";
import { loadGranteeOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

export const GET = (req: Request) =>
  handle(() => {
    const id = Number(new URL(req.url).searchParams.get("ngo_id"));
    const o = Number.isInteger(id) ? loadGranteeOverview(getDb(), id) : null;
    if (!o) throw new PayoutError("A valid ngo_id is required.", 400);
    return o;
  });
