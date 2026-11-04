// Minimal PayPal REST client (SANDBOX ONLY). API shapes verified against developer.paypal.com:
//  - OAuth:   POST {base}/v1/oauth2/token, Basic auth, body grant_type=client_credentials -> access_token, expires_in
//  - Payouts: POST {base}/v1/payments/payouts, GET {base}/v1/payments/payouts/{batch_id}
import { requireEnv } from "../env";
import { centsToDecimalString } from "../money";

const SANDBOX_HOST = "api-m.sandbox.paypal.com";

/** Human-readable failure; `code` is PayPal's error name when we have one (e.g. INSUFFICIENT_FUNDS). */
export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly kind: "AUTH" | "VALIDATION" | "INSUFFICIENT_FUNDS" | "NETWORK" | "OTHER",
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function baseUrl(): string {
  const raw = process.env.PAYPAL_BASE_URL || `https://${SANDBOX_HOST}`;
  // WHY: hard guard so a misconfigured env can never move real money. Sandbox hosts only.
  const host = new URL(raw).host;
  if (!host.includes("sandbox.paypal.com")) {
    throw new PayPalError(`Refusing to use non-sandbox PayPal host "${host}". This prototype is sandbox-only.`, "OTHER");
  }
  return raw.replace(/\/$/, "");
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const basic = Buffer.from(`${requireEnv("PAYPAL_CLIENT_ID")}:${requireEnv("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
  } catch (e) {
    throw new PayPalError(`Could not reach PayPal: ${(e as Error).message}`, "NETWORK");
  }
  if (!res.ok) {
    throw new PayPalError("PayPal rejected the sandbox credentials. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.", "AUTH", undefined, res.status);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function paypalFetch(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<unknown> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch (e) {
    throw new PayPalError(`Network error talking to PayPal: ${(e as Error).message}`, "NETWORK");
  }
  const text = await res.text();
  const json = text ? safeJson(text) : {};
  if (!res.ok) throw mapError(res.status, json);
  return json;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 500) }; }
}

function mapError(status: number, body: unknown): PayPalError {
  const b = (body ?? {}) as { name?: string; message?: string };
  const code = b.name;
  if (status === 401 || status === 403) return new PayPalError("PayPal authorization failed (check app credentials and that Payouts is enabled on the REST app).", "AUTH", code, status);
  if (code === "INSUFFICIENT_FUNDS" || code === "NEGATIVE_BALANCE")
    return new PayPalError("The sandbox sender account has insufficient funds. Add sandbox balance and retry.", "INSUFFICIENT_FUNDS", code, status);
  if (status === 400 || status === 422) return new PayPalError(`PayPal rejected the request: ${b.message ?? code ?? "validation error"}`, "VALIDATION", code, status);
  return new PayPalError(`PayPal error (${status}): ${b.message ?? code ?? "unknown"}`, "OTHER", code, status);
}

export type CreatePayoutInput = {
  senderBatchId: string;
  requestId: string;
  receiverEmail: string;
  amountCents: number;
  senderItemId: string;
  note: string;
};

export type PayoutBatchResult = { payoutBatchId: string; batchStatus: string };

/** Creates a single-item USD payout batch. The PayPal-Request-Id header makes retries of the same attempt safe. */
export async function createPayout(i: CreatePayoutInput): Promise<PayoutBatchResult> {
  const json = (await paypalFetch("/v1/payments/payouts", {
    method: "POST",
    headers: { "PayPal-Request-Id": i.requestId },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: i.senderBatchId,
        email_subject: "FieldGrant sandbox tranche payout",
        recipient_type: "EMAIL",
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: i.receiverEmail,
          amount: { currency: "USD", value: centsToDecimalString(i.amountCents) },
          sender_item_id: i.senderItemId,
          note: i.note,
        },
      ],
    }),
  })) as { batch_header?: { payout_batch_id?: string; batch_status?: string } };
  const h = json.batch_header;
  if (!h?.payout_batch_id) throw new PayPalError("PayPal returned an unexpected response (no payout_batch_id).", "OTHER");
  return { payoutBatchId: h.payout_batch_id, batchStatus: h.batch_status ?? "UNKNOWN" };
}

/** True when sandbox credentials are present. Lets the app run (and fail gracefully) before PayPal is set up. */
export function paypalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/**
 * POST /v1/notifications/verify-webhook-signature. `body` is a pre-built JSON string so the webhook event
 * is embedded exactly as received (PayPal warns that re-serializing it can break verification).
 * Response verification_status is SUCCESS or FAILURE per the API spec.
 */
export async function postVerifyWebhookSignature(body: string): Promise<boolean> {
  const json = (await paypalFetch("/v1/notifications/verify-webhook-signature", { method: "POST", body })) as { verification_status?: string };
  return json.verification_status === "SUCCESS";
}

export type BatchDetails = {
  batchStatus: string;
  items: { payoutItemId: string; transactionStatus: string; errors?: unknown }[];
};

export async function getPayoutBatch(batchId: string): Promise<BatchDetails> {
  const json = (await paypalFetch(`/v1/payments/payouts/${encodeURIComponent(batchId)}`, { method: "GET" })) as {
    batch_header?: { batch_status?: string };
    items?: { payout_item_id: string; transaction_status: string; errors?: unknown }[];
  };
  return {
    batchStatus: json.batch_header?.batch_status ?? "UNKNOWN",
    items: (json.items ?? []).map((it) => ({ payoutItemId: it.payout_item_id, transactionStatus: it.transaction_status, errors: it.errors })),
  };
}
