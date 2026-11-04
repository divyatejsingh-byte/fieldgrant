import { getDb, handle } from "@/lib/api";
import { PipelineError } from "@/lib/pipeline";
import { ngoDetail, submittableTranches } from "@/lib/queries";

export const dynamic = "force-dynamic";
/** Optional ?foundation_id= shows only that funder's grants (grantmaker view). */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const id = Number((await params).id);
    const f = Number(new URL(req.url).searchParams.get("foundation_id"));
    const d = ngoDetail(getDb(), id, Number.isInteger(f) && f > 0 ? f : undefined);
    if (!d) throw new PipelineError("NGO not found", 404);
    return { ...d, submittable: submittableTranches(getDb(), id) };
  });
