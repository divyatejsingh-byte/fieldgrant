import { handle } from "@/lib/api";
import { getSuggestedCovenants, listCatalog } from "@/lib/compliance-catalog";

export const dynamic = "force-dynamic";

/** The master catalog, plus a location-aware preset when ?funder=US&grantee=IN are given. */
export const GET = (req: Request) =>
  handle(() => {
    const q = new URL(req.url).searchParams;
    const f = q.get("funder");
    const g = q.get("grantee");
    return { catalog: listCatalog(), suggested: f && g ? getSuggestedCovenants(f, g) : [] };
  });
