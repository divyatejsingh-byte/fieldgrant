import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Render's health check and the in-app status badge. 200 when healthy, 503 when the database or uploads folder cannot be written. */
export const GET = () => {
  try {
    const h = checkHealth(getDb());
    return NextResponse.json(h, { status: h.status === "healthy" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", error: "Health check failed." }, { status: 503 });
  }
};
