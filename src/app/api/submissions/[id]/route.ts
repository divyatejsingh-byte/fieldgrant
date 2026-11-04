import { getDb, handle } from "@/lib/api";
import { PipelineError } from "@/lib/pipeline";
import { submissionDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const GET = (_: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const d = submissionDetail(getDb(), Number((await params).id));
    if (!d) throw new PipelineError("Submission not found", 404);
    return d;
  });
