import { getDb, handle } from "@/lib/api";
import { createReport, isReportType, listReports, ReportError } from "@/lib/reports";
import { storeUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** ?ngo_id= for a grantee's own reports, ?foundation_id= for the reports on a funder's grants. */
export const GET = (req: Request) =>
  handle(() => {
    const q = new URL(req.url).searchParams;
    const ngoId = Number(q.get("ngo_id"));
    const foundationId = Number(q.get("foundation_id"));
    return listReports(getDb(), {
      ngoId: Number.isInteger(ngoId) && ngoId > 0 ? ngoId : undefined,
      foundationId: Number.isInteger(foundationId) && foundationId > 0 ? foundationId : undefined,
    });
  });

/** A grantee shares a report (PDF/PNG/JPG) on one of their grants. Stored and listed only; never read by the model. */
export const POST = (req: Request) =>
  handle(async () => {
    const f = await req.formData();
    const ngoId = Number(f.get("ngo_id"));
    const grantId = Number(f.get("grant_id"));
    const type = String(f.get("period_type") ?? "");
    const period = String(f.get("period_label") ?? "").trim();
    const file = f.get("file");
    if (!Number.isInteger(ngoId) || !Number.isInteger(grantId)) throw new ReportError("Choose the grant this report is for.");
    if (!isReportType(type)) throw new ReportError("Choose monthly, quarterly or annual.");
    if (!(file instanceof File) || file.size === 0) throw new ReportError("Attach the report file.");
    const stored = storeUpload(Buffer.from(await file.arrayBuffer()), "report"); // PDF/PNG/JPG only, size-limited, hashed
    const id = createReport(getDb(), { ngoId, grantId, type, period, file: stored, fileName: file.name, note: String(f.get("note") ?? "") });
    return { id };
  });
