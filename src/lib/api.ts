import { NextResponse } from "next/server";
import { PayoutError, livePayPal } from "./payout/service";
import { PipelineError } from "./pipeline";
import { ReportError } from "./reports";
import { UploadError } from "./uploads";
import { getDb } from "./db";

export { getDb, livePayPal };

/** Route wrapper: known errors become clear 4xx messages; anything unexpected is a generic 500 (no internals leaked). */
export async function handle(fn: () => Promise<unknown> | unknown): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof PipelineError || e instanceof PayoutError || e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("API error:", (e as Error).message);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
