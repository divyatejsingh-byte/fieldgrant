import fs from "node:fs";
import { getDb } from "@/lib/api";
import { getReportFile } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** Serves a stored report to whoever opens the link (the demo has no access control). Never executes it: sandboxed, no sniffing. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const row = Number.isInteger(id) ? getReportFile(getDb(), id) : undefined;
  if (!row || !fs.existsSync(row.file_path)) return new Response("Report not found.", { status: 404 });
  const safeName = row.file_name.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(fs.readFileSync(row.file_path)), {
    headers: {
      "Content-Type": row.media_type,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      "Cache-Control": "private, max-age=60",
    },
  });
}
