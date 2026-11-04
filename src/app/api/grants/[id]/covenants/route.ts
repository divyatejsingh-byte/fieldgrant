import { getDb, handle } from "@/lib/api";
import { saveGrantCovenants } from "@/lib/compliance";
import { CovenantInputError } from "@/lib/compliance-catalog";
import { PayoutError } from "@/lib/payout/service";

export const dynamic = "force-dynamic";

/**
 * Replace a grant's covenants. Input is validated and normalised server-side: standard codes take their canonical
 * definition from the catalog, custom covenants get a server-checked UUID and a clean single-line name.
 * Changes apply to FUTURE submissions; decisions already made are not re-evaluated.
 */
export const PUT = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const id = Number((await params).id);
    if (!getDb().prepare("SELECT 1 FROM grant_award WHERE id=?").get(id)) throw new PayoutError("Grant not found", 404);
    const body = (await req.json().catch(() => ({}))) as { covenants?: unknown };
    try {
      return { covenants: saveGrantCovenants(getDb(), id, body.covenants) };
    } catch (e) {
      if (e instanceof CovenantInputError) throw new PayoutError(e.message, 400);
      throw e;
    }
  });
