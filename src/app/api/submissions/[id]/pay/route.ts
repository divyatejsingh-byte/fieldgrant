import { getDb, handle, livePayPal } from "@/lib/api";
import { releaseTranche } from "@/lib/payout/service";

export const dynamic = "force-dynamic";
/** (Re)try the payout for a RELEASE decision. Safe to call repeatedly: the service refuses RELEASING/PAID tranches. */
export const POST = (_: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => releaseTranche(getDb(), livePayPal, Number((await params).id)));
