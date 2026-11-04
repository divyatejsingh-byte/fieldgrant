import { postVerifyWebhookSignature } from "./client";

export type VerifyFn = (headers: Headers, rawBody: string) => Promise<boolean>;

/**
 * WHY: a webhook endpoint is a public URL; anyone can POST "payout succeeded" to it. We therefore trust
 * NOTHING in the payload until PayPal itself confirms the signature (verify-webhook-signature API, per the
 * PayPal docs). Any missing header, missing webhook id, odd cert host, or API error means REJECT (fail closed).
 * The raw body is forwarded untouched because re-serializing parsed JSON can invalidate the signature.
 */
export const verifyPayPalWebhook: VerifyFn = async (headers, rawBody) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const h = (n: string) => headers.get(n);
  const transmissionId = h("paypal-transmission-id");
  const transmissionTime = h("paypal-transmission-time");
  const sig = h("paypal-transmission-sig");
  const certUrl = h("paypal-cert-url");
  const algo = h("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !sig || !certUrl || !algo) return false;
  try {
    const u = new URL(certUrl);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".paypal.com")) return false;
    const body =
      `{"auth_algo":${JSON.stringify(algo)},"cert_url":${JSON.stringify(certUrl)},"transmission_id":${JSON.stringify(transmissionId)},` +
      `"transmission_sig":${JSON.stringify(sig)},"transmission_time":${JSON.stringify(transmissionTime)},"webhook_id":${JSON.stringify(webhookId)},` +
      `"webhook_event":${rawBody}}`;
    return await postVerifyWebhookSignature(body);
  } catch {
    return false;
  }
};
