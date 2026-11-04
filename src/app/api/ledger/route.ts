import { getDb, handle } from "@/lib/api";
import { ledgerRows } from "@/lib/queries";

export const dynamic = "force-dynamic";
/** Optional ?ngo_id= and ?foundation_id= filters. */
export const GET = (req: Request) =>
  handle(() => {
    const q = new URL(req.url).searchParams;
    const pos = (k: string) => { const n = Number(q.get(k)); return Number.isInteger(n) && n > 0 ? n : undefined; };
    return ledgerRows(getDb(), { ngoId: pos("ngo_id"), foundationId: pos("foundation_id") });
  });
