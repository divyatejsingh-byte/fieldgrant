import { handle } from "@/lib/api";
import { configuredProvider } from "@/lib/llm";
import { paypalConfigured } from "@/lib/paypal/client";

export const dynamic = "force-dynamic";

/** Configuration status only (are keys present?). It never returns a key and does not call external services. */
export const GET = () =>
  handle(() => ({
    verificationEngine: configuredProvider(), // "gemini" | "anthropic" | null
    paypalSandbox: paypalConfigured(),
    webhookConfigured: !!process.env.PAYPAL_WEBHOOK_ID,
  }));
