"use client";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Loader2, PauseCircle, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { crossesFiscalBoundary, defaultLocalFY, fyMonthsLabel, getFiscalYear } from "@/lib/fiscal-year";
import { formatUsd } from "@/lib/money";
import type { Band, Check, SubmissionDetail } from "./types";
import { ConsensusDiff } from "./ConsensusDiff";
import { GateCard } from "./GateCard";
import { IdButton } from "./RailInspector";
import { Badge, DATA_CHANGED, ErrorBox, Money, Panel, emitDataChanged, postJson } from "./ui";

const BANDS: { key: Band; label: string; on: string }[] = [
  { key: "RELEASE", label: "Approved", on: "bg-emerald-600 text-white" },
  { key: "OFFICER_REVIEW", label: "Needs review", on: "bg-amber-500 text-white" },
  { key: "HOLD", label: "On hold", on: "bg-rose-600 text-white" },
];

const RAIL: Record<string, string> = { RELEASE: "bg-emerald-600", OFFICER_REVIEW: "bg-amber-500", HOLD: "bg-rose-600", NONE: "bg-zinc-500" };

function Result({ c }: { c?: Check }) {
  if (!c) return <span className="text-zinc-300">-</span>;
  if (c.passed) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Passed" />;
  return c.severity === "HARD" ? <XCircle className="h-4 w-4 text-rose-600" aria-label="Failed" /> : <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Needs a look" />;
}

/** Which fiscal year the receipt belongs to for the funder (accounting basis) and for the grantee (statutory). */
function FiscalPill({ d }: { d: SubmissionDetail }) {
  if (d.extractionSkipped) return null; // Gate 1 stopped the submission before any receipt was read
  const date = d.extracted?.dateISO;
  if (!date) return <div className="text-[12px] text-zinc-400">Reporting year unavailable: the receipt date could not be read.</div>;
  const funder = d.funderFyModel;
  const local = defaultLocalFY(d.ngo.countryCode);
  const cross = crossesFiscalBoundary(date, funder, local);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="num inline-flex items-center rounded border border-zinc-200/80 bg-white px-2 py-0.5 text-[12px] text-zinc-700">
        Funder {getFiscalYear(date, funder)} ({fyMonthsLabel(funder)}) <span className="mx-1.5 text-zinc-300">•</span> Grantee Local {getFiscalYear(date, local)} ({fyMonthsLabel(local)})
      </span>
      {cross && <span title="The same receipt date falls in different fiscal years for funder and grantee; it is counted in the funder's year." className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">Cross-FY Reconciled</span>}
    </div>
  );
}

type Row = { field: string; extracted: ReactNode; rule: ReactNode; check?: Check };

/** One plain sentence about what happened and what it means for the reader. */
function verdictFor(d: SubmissionDetail, role: "foundation" | "ngo", settling: boolean) {
  const amount = formatUsd(d.tranche.amount_cents);
  if (d.decision === "RELEASE") {
    if (d.tranche.status === "PAID") return { tone: "border-emerald-300 bg-emerald-50", icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />, title: "Approved and paid", sub: `The ${amount} payment was delivered through PayPal.` };
    if (settling) return { tone: "border-sky-300 bg-sky-50", icon: <Clock className="h-6 w-6 text-sky-700" />, title: "Approved: your payment is on its way", sub: `PayPal is processing ${amount}. This updates by itself.` };
    return { tone: "border-emerald-300 bg-emerald-50", icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />, title: "Approved", sub: role === "ngo" ? `Everything checked out. The ${amount} payment hasn't been sent yet.` : `Everything checked out. The ${amount} payment is ready to send.` };
  }
  if (d.decision === "OFFICER_REVIEW") {
    return { tone: "border-amber-300 bg-amber-50", icon: <Clock className="h-6 w-6 text-amber-700" />, title: role === "ngo" ? "A person needs to take a look" : "This needs your decision", sub: role === "ngo" ? "Nothing is wrong yet: something couldn't be confirmed automatically. A program officer will review it." : "Something couldn't be confirmed automatically. Approve or hold it below." };
  }
  if (d.decision === "HOLD") {
    return { tone: "border-rose-300 bg-rose-50", icon: <PauseCircle className="h-6 w-6 text-rose-700" />, title: d.extractionSkipped ? "On hold: required documents are missing" : "On hold: here's what to fix", sub: `The ${amount} payment is paused. No money has moved.` };
  }
  return { tone: "border-zinc-200/80 bg-white", icon: <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />, title: "Checking your documents", sub: "This takes about 20 seconds." };
}

/** `role` only changes what is shown: NGOs see status; the grantmaker also gets payment sending and the decision controls. */
export function Inspection({ d, onChange, role = "foundation" }: { d: SubmissionDetail; onChange: () => void; role?: "foundation" | "ngo" }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const settling = d.tranche.status === "RELEASING";

  // The PayPal rail inspector (or any other screen) can change the payout status: reload when it says so.
  useEffect(() => {
    window.addEventListener(DATA_CHANGED, onChange);
    return () => window.removeEventListener(DATA_CHANGED, onChange);
  }, [onChange]);

  // Browser-side polling fallback (server polls too, and webhooks may arrive). Bounded to ~4 minutes.
  useEffect(() => {
    if (!settling) return;
    let n = 0;
    const t = setInterval(async () => {
      if (++n > 30) return clearInterval(t);
      try { await postJson(`/api/submissions/${d.id}/refresh`); } catch { /* keep trying */ }
      onChange();
    }, 8000);
    return () => clearInterval(t);
  }, [settling, d.id, onChange]);

  const byName = (n: string) => d.checks.find((c) => c.name === n);
  const passed = d.checks.filter((c) => c.passed).length;
  const x = d.extracted;
  const req = d.tranche.requirements;
  const maxCents = Math.floor((req.budget_line_cents * (100 + req.tolerance_pct)) / 100);
  const lineSum = x && x.lineItems.length && x.lineItems.every((l) => l.amountCents !== null) ? x.lineItems.reduce((s, l) => s + (l.amountCents as number), 0) : null;

  const rows: Row[] = [
    { field: "Seller", extracted: x?.vendor ?? "Couldn't read", rule: "Receipt not already used by any NGO", check: byName("duplicate_vendor_date_amount") },
    { field: "Receipt date", extracted: <span className="num">{x?.dateISO ?? "Couldn't read"}</span>, rule: <span>Within the grant dates (<span className="num">{d.grant.start_date}</span> to <span className="num">{d.grant.end_date}</span>)</span>, check: byName("receipt_date_in_grant_period") },
    { field: "Receipt total", extracted: <Money cents={x?.totalCents} />, rule: <span>At most <Money cents={maxCents} /></span>, check: byName("receipt_total_vs_budget_line") },
    { field: "Items add up", extracted: <Money cents={lineSum} />, rule: "Matches the receipt total", check: byName("line_items_sum_to_total") },
    { field: "People on the list", extracted: <span className="num">{x?.attendeeCount ?? "Couldn't read"}</span>, rule: req.required_attendees ? <span>At least <span className="num">{req.required_attendees}</span></span> : "No minimum", check: byName("attendee_count_meets_requirement") },
    { field: "Receipt file", extracted: "Saved with a fingerprint", rule: "Not an exact copy of an earlier file", check: byName("duplicate_file_hash") },
  ];
  const failedRows = rows.filter((r) => r.check && !r.check.passed);

  async function act(path: string, body?: unknown) {
    setBusy(true); setMsg(null);
    try {
      const r = await postJson<{ payoutError?: string } | null>(path, body);
      // A decision can be saved even though the payment could not start (e.g. PayPal not configured): say so.
      if (r?.payoutError) setMsg(`Decision saved, but the payment could not be sent: ${r.payoutError}`);
    } catch (e) { setMsg((e as Error).message); }
    emitDataChanged();
    onChange();
    setBusy(false);
  }
  const unpaid = d.decision === "RELEASE" && ["PENDING_EVIDENCE", "IN_REVIEW", "HELD"].includes(d.tranche.status);
  const canPay = unpaid && role === "foundation";
  const canOverride = role === "foundation" && ["OFFICER_REVIEW", "HOLD"].includes(d.decision ?? "") && ["IN_REVIEW", "HELD"].includes(d.tranche.status);
  const lastFail = [...d.ledger].reverse().find((e) => e.event_type === "PAYOUT_FAILED");
  const v = verdictFor(d, role, settling);

  return (
    <div className="space-y-4">
      {/* 1. The verdict: the band first (immediate, unambiguous), then the answer in plain words */}
      <section className={`flex overflow-hidden rounded-lg border shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${v.tone}`} aria-label="Decision">
        <div className={`flex w-[104px] flex-none flex-col items-center justify-center gap-1 px-2 py-4 text-center text-white sm:w-[132px] ${RAIL[d.decision ?? "NONE"]}`}>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-80">Verdict</span>
          <span className="font-mono text-[14px] font-semibold leading-4 tracking-wide sm:text-[15px]">{(d.decision ?? "PENDING").replace("_", " ")}</span>
        </div>
        <div className="min-w-0 flex-1 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-none">{v.icon}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[19px] font-semibold leading-6 tracking-tight">{v.title}</h3>
              <p className="mt-0.5 text-[14px] leading-5 text-zinc-700">{v.sub}</p>
            </div>
          </div>
          {d.explanation && <p className="mt-3 text-[14px] leading-5 text-zinc-800">{d.explanation}</p>}
          {d.decision !== "RELEASE" && d.remediation && (
            <div className="mt-3 rounded-md border border-zinc-200 bg-white/80 px-3 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">What to do next</div>
              <p className="mt-0.5 text-[14px] leading-5 text-zinc-800">{d.remediation}</p>
            </div>
          )}
        </div>
      </section>

      {/* 2. The payment */}
      <Panel title="Payment">
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          {settling && <span className="inline-flex items-center gap-1.5 font-medium text-sky-800"><Loader2 className="h-4 w-4 animate-spin" /> Payment sent. PayPal is processing it.</span>}
          {d.tranche.status === "PAID" && <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800"><ShieldCheck className="h-4 w-4" /> Paid through PayPal (sandbox)</span>}
          {!settling && d.tranche.status !== "PAID" && <span className="text-zinc-600">{unpaid ? (role === "ngo" ? "Approved, but the payment hasn't been sent yet." : "Approved, not sent yet.") : role === "ngo" && d.decision === "OFFICER_REVIEW" ? "No payment yet. A program officer is reviewing; you only need to act if they ask." : "No payment has been made."}</span>}
          {d.payout && <Badge status={d.payout.status} />}
        </div>
        {d.payout && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">payout_batch_id</dt><dd><IdButton value={d.payout.batchId} batchId={d.payout.batchId} /></dd>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">payout_item_id</dt><dd><IdButton value={d.payout.itemId} batchId={d.payout.batchId} /></dd>
          </dl>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {settling && <button className="btn-secondary" disabled={busy} onClick={() => act(`/api/submissions/${d.id}/refresh`)}>Check payment status</button>}
          {canPay && <button className="btn-clear h-9 px-4 text-[14px]" disabled={busy} onClick={() => act(`/api/submissions/${d.id}/pay`)}>{lastFail ? "Try sending again" : "Send payment"}</button>}
        </div>
        {lastFail && canPay && <p className="mt-2 text-[13px] text-rose-700">The last attempt failed: {lastFail.payload.message}</p>}
        {msg && <div className="mt-3"><ErrorBox message={msg} /></div>}
      </Panel>

      {/* 3. The reviewer's decision (reason is mandatory and saved in the history) */}
      {canOverride && (
        <Panel title="Your decision">
          <p className="mb-2 text-[13px] text-zinc-600">Approve and pay this {formatUsd(d.tranche.amount_cents)}, or keep it on hold. Give a reason: it&apos;s saved in the history with your name and the time.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field h-9 min-w-56 flex-1 text-[14px]" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
            <button className="btn-clear h-9 px-4 text-[14px]" disabled={busy || reason.trim().length < 5} onClick={() => act("/api/review/override", { submissionId: d.id, newDecision: "RELEASE", reason })}>Approve and pay</button>
            <button className="btn-danger h-9 px-4 text-[14px]" disabled={busy || reason.trim().length < 5 || d.tranche.status === "HELD"} onClick={() => act("/api/review/override", { submissionId: d.id, newDecision: "HOLD", reason })}>Keep on hold</button>
          </div>
        </Panel>
      )}

      {/* Gate 1 clearance card: visible on both views, above the invoice rules */}
      {d.covenants.length > 0 && <GateCard grantId={d.grant.id} note={d.extractionSkipped ? "Because of this, the receipt and proof of work were not read." : undefined} />}

      {/* 4. How it was decided: all the detail, folded away */}
      <details open={d.decision !== "RELEASE" && role === "foundation"} className="group rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-90" />
          How this was decided
          <span className="text-[12px] font-normal text-zinc-500">{passed} of {d.checks.length} checks passed</span>
        </summary>
        <div className="space-y-4 border-t border-zinc-200 p-4">
          <div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200" role="img" aria-label={`Outcome: ${BANDS.find((b) => b.key === d.decision)?.label ?? "pending"}`}>
              {BANDS.map((b) => (
                <div key={b.key} className={`flex h-9 items-center justify-center text-[13px] font-semibold ${d.decision === b.key ? b.on : "bg-white text-zinc-400"}`}>{b.label}</div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-zinc-500">The outcome is decided by fixed rules. AI only reads your documents and writes the explanation afterwards; it can&apos;t approve or pay anything.</p>
          </div>
          <FiscalPill d={d} />

          {!d.extractionSkipped && <ConsensusDiff c={d.consensus} reasons={d.reliability?.reasons ?? []} decision={d.decision} />}

          {!d.extractionSkipped && (
            <Panel title="What we read vs what's required" flush>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[14px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left"><th className="label px-4 py-2">Item</th><th className="label py-2">What we read</th><th className="label py-2">What&apos;s required</th><th className="label w-16 px-4 py-2 text-center">Result</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.field} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-2 text-zinc-600">{r.field}</td>
                        <td className="py-2 font-medium">{r.extracted}</td>
                        <td className="py-2 text-zinc-600">{r.rule}</td>
                        <td className="px-4 py-2"><div className="flex justify-center"><Result c={r.check} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {failedRows.length > 0 && (
                <ul className="space-y-1 border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[13px] text-zinc-700">
                  {failedRows.map((r) => <li key={r.field} className="flex gap-2"><Result c={r.check} /> <span>{r.check?.detail}</span></li>)}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 px-4 py-2.5 text-[13px]">
                <span className="text-zinc-600">How clearly the documents were read</span>
                <Badge status={d.reliability?.reliable ? "RELIABLE" : "UNRELIABLE"} />
                {d.reliability?.reasons.map((r, i) => <span key={i} className="text-amber-800">{r}</span>)}
              </div>
              <details className="border-t border-zinc-200 px-4 py-2.5 text-[12px]">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-3.5 w-3.5 transition-transform [details[open]_&]:rotate-90" /> Technical details (for auditors)
                </summary>
                <ul className="mt-2 divide-y divide-zinc-100">
                  {d.checks.filter((c) => !c.name.startsWith("covenant_")).map((c) => (
                    <li key={c.name} className="flex items-start gap-2 py-1.5"><span className="mt-0.5"><Result c={c} /></span>
                      <div><span className="font-mono text-[11px] text-zinc-500">{c.name}</span> <span className="rounded border border-zinc-200 px-1 text-[10px] font-semibold text-zinc-500">{c.severity}</span>
                        <div className="text-zinc-700">{c.detail}</div></div></li>
                  ))}
                </ul>
              </details>
            </Panel>
          )}
        </div>
      </details>
    </div>
  );
}
