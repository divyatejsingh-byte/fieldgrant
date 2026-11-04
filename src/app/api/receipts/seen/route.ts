import { getDb, handle } from "@/lib/api";
import { receiptSeen } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** ?sha256= : has this exact file been submitted before? Used by the cross-NGO duplicate demo scenario. */
export const GET = (req: Request) =>
  handle(() => {
    const h = new URL(req.url).searchParams.get("sha256") ?? "";
    return { seen: /^[a-f0-9]{64}$/.test(h) ? receiptSeen(getDb(), h) : false };
  });
