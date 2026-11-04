import { getDb, handle } from "@/lib/api";
import { isFYModel } from "@/lib/fiscal-year";
import { getFoundation, setFoundationFyModel } from "@/lib/foundations";
import { PayoutError } from "@/lib/payout/service";

export const dynamic = "force-dynamic";

/** Change one funder's fiscal-year model (CALENDAR | APRIL_MARCH | JULY_JUNE | OCTOBER_SEPTEMBER). */
export const PUT = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const id = Number((await params).id);
    const b = (await req.json().catch(() => ({}))) as { fyModel?: unknown };
    if (!isFYModel(b.fyModel)) throw new PayoutError("fyModel must be CALENDAR, APRIL_MARCH, JULY_JUNE or OCTOBER_SEPTEMBER.", 400);
    if (!setFoundationFyModel(getDb(), id, b.fyModel)) throw new PayoutError("Foundation not found", 404);
    return getFoundation(getDb(), id);
  });
