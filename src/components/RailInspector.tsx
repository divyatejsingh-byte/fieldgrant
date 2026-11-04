"use client";
import { Loader2, RefreshCw, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Badge, CopyId, ErrorBox, Money, Skeleton, emitDataChanged, postJson, useApi } from "./ui";

type Inspector = {
  batchId: string; itemId: string | null; status: string | null; destinationEmail: string; ngoName: string; amountCents: number;
  grantName: string; trancheSeq: number; senderBatchId: string; attempt: number; requestId: string; dispatchedAt: string;
  webhook: { verifiedCount: number; lastType: string | null; lastAt: string | null };
  events: { id: number; eventType: string; actor: string; status: string | null; at: string; webhookType: string | null }[];
};

const Ctx = createContext<(batchId: string) => void>(() => {});
const micro = "text-[10px] font-mono uppercase tracking-wider text-zinc-500";

/** Wrap a page (or the whole app shell) once; any <IdButton> below it opens the same slide-over. */
export function RailInspectorProvider({ children }: { children: ReactNode }) {
  const [batch, setBatch] = useState<string | null>(null);
  const close = useCallback(() => setBatch(null), []);
  useEffect(() => {
    if (!batch) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [batch, close]);
  return (
    <Ctx.Provider value={setBatch}>
      {children}
      {batch && <Drawer batchId={batch} onClose={close} />}
    </Ctx.Provider>
  );
}

/** A PayPal id rendered as a monospace button that opens the Rail Inspector for its batch. */
export function IdButton({ value, batchId, className = "" }: { value: string | null | undefined; batchId: string | null | undefined; className?: string }) {
  const open = useContext(Ctx);
  if (!value) return <span className="text-zinc-300">-</span>;
  if (!batchId) return <span className={`font-mono text-[12px] ${className}`}>{value}</span>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); open(batchId); }} title="Open the PayPal rail inspector"
      className={`inline-flex max-w-full items-center truncate rounded border border-zinc-200/80 bg-white px-1.5 py-0.5 font-mono text-[12px] text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 ${className}`}>
      {value}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-zinc-100 px-4 py-2.5 last:border-0">
      <div className={micro}>{label}</div>
      <div className="mt-1 break-all font-mono text-[12px] text-zinc-900">{children}</div>
    </div>
  );
}

function Drawer({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { data, error, loading, setData } = useApi<Inspector>(`/api/payouts/${encodeURIComponent(batchId)}`, 15000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function poll() {
    setBusy(true); setErr(null);
    try { setData(await postJson<Inspector>(`/api/payouts/${encodeURIComponent(batchId)}/refresh`)); emitDataChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const wh = data?.webhook;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="PayPal rail inspector">
      <div className="absolute inset-0 bg-zinc-950/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col border-l border-zinc-200/80 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <div className={micro}>PayPal rail inspector · sandbox</div>
            <div className="mt-1 text-[15px] font-semibold tracking-tight">Payout batch</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {loading && !data && <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
          {error && !data && <div className="p-4"><ErrorBox message={error} /></div>}
          {data && (
            <>
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                <div><div className={micro}>Batch status</div><div className="mt-1"><Badge status={data.status} /></div></div>
                <div className="text-right"><div className={micro}>Amount</div><div className="mt-1 font-mono text-[15px] font-semibold"><Money cents={data.amountCents} /></div></div>
              </div>
              <Field label="PayPal payout_batch_id"><CopyId value={data.batchId} /></Field>
              <Field label="PayPal payout_item_id">{data.itemId ? <CopyId value={data.itemId} /> : <span className="text-zinc-400">not yet reported by PayPal</span>}</Field>
              <Field label="Destination sandbox email">{data.destinationEmail}</Field>
              <Field label="sender_batch_id (unique per grant, tranche, attempt)">{data.senderBatchId} <span className="text-zinc-400">· attempt {data.attempt}</span></Field>
              <Field label="PayPal-Request-Id (idempotency header)">{data.requestId}</Field>
              <Field label="Dispatched (UTC)">{data.dispatchedAt}</Field>
              <Field label="Webhook signature verification">
                {wh && wh.verifiedCount > 0 ? (
                  <span className="text-emerald-700">Verified via /v1/notifications/verify-webhook-signature · {wh.verifiedCount} event{wh.verifiedCount === 1 ? "" : "s"}<br /><span className="text-zinc-500">last: {wh.lastType ?? "event"} · {wh.lastAt}</span></span>
                ) : (
                  <span className="text-amber-700">No webhook received yet<br /><span className="text-zinc-500">status so far comes from polling PayPal. A webhook is only accepted after its signature verifies.</span></span>
                )}
              </Field>
              <div className="px-4 py-3">
                <div className={micro}>Event trail</div>
                <ul className="mt-2 space-y-1.5">
                  {data.events.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[130px] flex-none font-mono text-zinc-500">{e.at}</span>
                      <span className="font-mono text-zinc-800">{e.eventType}</span>
                      <span className={`rounded border px-1 font-mono text-[10px] uppercase ${e.actor === "WEBHOOK" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 text-zinc-500"}`}>{e.actor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        <footer className="border-t border-zinc-200 p-4">
          {err && <div className="mb-2"><ErrorBox message={err} /></div>}
          <button type="button" className="btn-primary h-9 w-full" disabled={busy || !data} onClick={poll}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Trigger sandbox status poll
          </button>
          <p className="mt-2 text-[11px] leading-4 text-zinc-500">Asks the PayPal sandbox for the batch&apos;s current status and records any change in the ledger. Sandbox only; no real money.</p>
        </footer>
      </aside>
    </div>
  );
}
