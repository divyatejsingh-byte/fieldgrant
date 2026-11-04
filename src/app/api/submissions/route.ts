import { getDb, handle, livePayPal } from "@/lib/api";
import { getLlm } from "@/lib/llm";
import { releaseTranche } from "@/lib/payout/service";
import { PipelineError, processSubmission } from "@/lib/pipeline";
import { storeUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // two extraction calls + explanation

export const POST = (req: Request) =>
  handle(async () => {
    const form = await req.formData();
    const ngoId = Number(form.get("ngo_id"));
    const trancheId = Number(form.get("tranche_id"));
    if (!Number.isInteger(ngoId) || !Number.isInteger(trancheId)) throw new PipelineError("ngo_id and tranche_id are required.");
    const receiptFile = form.get("receipt");
    if (!(receiptFile instanceof File) || receiptFile.size === 0) throw new PipelineError("A receipt file is required.");
    // Any mix of up to 5 supporting files (attendance list, project photos, report). "roster" is the older single-file field.
    const supportingFiles = [...form.getAll("evidence"), ...form.getAll("roster")].filter((f): f is File => f instanceof File && f.size > 0);
    const memo = String(form.get("memo") ?? "");

    const receipt = storeUpload(Buffer.from(await receiptFile.arrayBuffer()), "receipt");
    if (supportingFiles.length > 5) throw new PipelineError("Please send at most 5 supporting files.");
    const evidence = await Promise.all(supportingFiles.map(async (f) => storeUpload(Buffer.from(await f.arrayBuffer()), "supporting")));

    const db = getDb();
    return processSubmission(
      { db, llm: getLlm(), release: (sid) => releaseTranche(db, livePayPal, sid) },
      { ngoId, trancheId, receipt, evidence, memoText: memo },
    );
  });
