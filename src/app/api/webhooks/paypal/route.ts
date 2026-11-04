import { NextResponse } from "next/server";
import { getDb, livePayPal } from "@/lib/api";
import { handlePayPalWebhook } from "@/lib/payout/webhook-handler";
import { verifyPayPalWebhook } from "@/lib/paypal/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Read the RAW text: the signature check needs the body exactly as received.
  const raw = await req.text();
  const r = await handlePayPalWebhook(getDb(), livePayPal, verifyPayPalWebhook, req.headers, raw);
  return NextResponse.json(r.body, { status: r.status });
}
