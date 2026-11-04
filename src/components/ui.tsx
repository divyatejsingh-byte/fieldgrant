"use client";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatUsd } from "@/lib/money";

type Tone = "emerald" | "amber" | "rose" | "sky" | "zinc";

const TONES: Record<Tone, { chip: string; dot: string }> = {
  emerald: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  amber: { chip: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  rose: { chip: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  sky: { chip: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  zinc: { chip: "border-zinc-200 bg-zinc-50 text-zinc-600", dot: "bg-zinc-400" },
};

/** Display labels. Stored values (RELEASE, HELD...) never change; only how they read in the UI. */
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  RELEASE: { label: "Approved", tone: "emerald" },
  OFFICER_REVIEW: { label: "Needs review", tone: "amber" },
  HOLD: { label: "On hold", tone: "rose" },
  PAID: { label: "Paid", tone: "emerald" },
  RELEASING: { label: "Payment sent", tone: "sky" },
  PENDING_EVIDENCE: { label: "Waiting for documents", tone: "zinc" },
  LOCKED: { label: "Not open yet", tone: "zinc" },
  IN_REVIEW: { label: "Under review", tone: "amber" },
  HELD: { label: "On hold", tone: "rose" },
  SUCCESS: { label: "Success", tone: "emerald" },
  PENDING: { label: "Pending", tone: "sky" },
  PROCESSING: { label: "Processing", tone: "sky" },
  UNCLAIMED: { label: "Unclaimed", tone: "amber" },
  ONHOLD: { label: "On hold", tone: "amber" },
  FAILED: { label: "Failed", tone: "rose" },
  BLOCKED: { label: "Blocked", tone: "rose" },
  DENIED: { label: "Denied", tone: "rose" },
  RETURNED: { label: "Returned", tone: "rose" },
  RECEIVED: { label: "Received", tone: "zinc" },
  RELIABLE: { label: "Reliable", tone: "emerald" },
  ACTIVE: { label: "Active", tone: "emerald" },
  VERIFIED: { label: "Verified", tone: "emerald" },
  EXPIRED: { label: "Expired", tone: "amber" },
  MISSING: { label: "Missing", tone: "rose" },
  REVOKED: { label: "Revoked", tone: "rose" },
  UNRELIABLE: { label: "Unreliable", tone: "amber" },
};

export function Badge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-zinc-300">-</span>;
  const m = STATUS[status] ?? { label: status.replaceAll("_", " ").toLowerCase(), tone: "zinc" as Tone };
  const t = TONES[m.tone];
  return (
    <span className={`inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded border px-1.5 text-[11px] font-medium leading-none ${t.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />
      {m.label}
    </span>
  );
}

export function Panel({ title, right, children, className = "", flush = false }: { title?: string; right?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {title && (
        <header className="flex min-h-10 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2">
          <h2 className="micro">{title}</h2>
          {right}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold leading-7 tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 max-w-2xl text-[13px] text-zinc-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-zinc-500" role="status">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label}
    </div>
  );
}

/** A small "?" that explains a term in one sentence, on hover or keyboard focus. */
export function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={`What does this mean? ${text}`} className="ml-1.5 grid h-4 w-4 place-items-center rounded-full border border-zinc-300 text-[10px] font-semibold leading-none text-zinc-500 hover:bg-zinc-100 focus:bg-zinc-100">?</button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-64 -translate-x-1/2 rounded-md border border-zinc-200/80 bg-white p-2.5 text-[12px] font-normal normal-case leading-4 tracking-normal text-zinc-700 shadow-lg group-focus-within:block group-hover:block">{text}</span>
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-100 ${className}`} aria-hidden />;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800" role="alert">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" /> <span>{message}</span>
    </div>
  );
}

export function Money({ cents, className = "" }: { cents: number | null | undefined; className?: string }) {
  return <span className={`num ${className}`}>{cents === null || cents === undefined ? "-" : formatUsd(cents)}</span>;
}

/** Monospace identifier with one-click copy (payout_batch_id, hashes). */
export function CopyId({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const [done, setDone] = useState(false);
  if (!value) return <span className="text-zinc-300">-</span>;
  return (
    <button
      type="button"
      title="Copy"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
      }}
      className={`group inline-flex max-w-full items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[12px] hover:border-zinc-300 hover:bg-white ${className}`}
    >
      <span className="num truncate">{value}</span>
      {done ? <Check className="h-3 w-3 flex-none text-emerald-600" /> : <Copy className="h-3 w-3 flex-none text-zinc-400 group-hover:text-zinc-700" />}
    </button>
  );
}

/** Tiny fetch hook with loading + error state, optional polling, and a reload function. */
export function useApi<T>(url: string | null, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
      setData(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => { setLoading(!!url); void reload(); }, [url, reload]);
  useEffect(() => {
    if (!url || !intervalMs) return;
    const t = setInterval(() => { if (!document.hidden) void reload(); }, intervalMs);
    return () => clearInterval(t);
  }, [url, intervalMs, reload]);
  return { data, error, loading, reload, setData };
}

/** Tells live widgets (e.g. the utilization bar) that money or decisions changed, so they refetch immediately. */
export const DATA_CHANGED = "fg:data-changed";
export const emitDataChanged = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED)); };

export async function postJson<T = unknown>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}
