"use client";
import { useApi } from "./ui";

/** Configuration status only (are keys present?). Never a key, never a live call to a third party. */
export function SystemStatus() {
  const { data: s } = useApi<{ verificationEngine: string | null; paypalSandbox: boolean; webhookConfigured: boolean }>("/api/status");
  const item = (on: boolean, label: string) => (
    <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />{label}</span>
  );
  return (
    <div className="flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-600" aria-label="System status">
      {s ? (
        <>
          {item(!!s.verificationEngine, s.verificationEngine ? `Verification engine: ${s.verificationEngine}` : "Verification engine: not configured")}
          {item(s.paypalSandbox, s.paypalSandbox ? "PayPal sandbox: configured" : "PayPal sandbox: not configured")}
          {item(s.webhookConfigured, s.webhookConfigured ? "Webhook: configured" : "Webhook: not configured")}
        </>
      ) : null}
    </div>
  );
}
