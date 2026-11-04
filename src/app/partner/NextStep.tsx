"use client";
import { ArrowRight, CheckCircle2, Clock, FileWarning, Send } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { formatUsd } from "@/lib/money";
import { usePartner } from "./layout";

/** Tells the grantee the ONE thing to do now. Everything else on the page is detail. */
export function NextStep({ onStart }: { onStart: (trancheId: number) => void }) {
  const { overview: o } = usePartner();
  if (!o) return <Skeleton className="mb-5 h-28 w-full" />;

  const grants = o.funders.flatMap((f) => f.grants.map((g) => ({ ...g, funder: f.foundation.name })));
  const actionable = o.funders.flatMap((f) => f.actionable.map((a) => ({ ...a, funder: f.foundation.name })));
  const blocked = (grantId: number) => grants.find((g) => g.id === grantId)?.compliance.blockingOutstanding ?? 0;
  const ready = actionable.find((a) => blocked(a.grantId) === 0);
  const stuck = grants.find((g) => g.compliance.blockingOutstanding > 0 && g.tranches.some((t) => ["PENDING_EVIDENCE", "HELD"].includes(t.status)));
  const sending = grants.flatMap((g) => g.tranches.filter((t) => t.status === "RELEASING").map((t) => ({ ...t, grant: g })));
  const inReview = grants.flatMap((g) => g.tranches.filter((t) => t.status === "IN_REVIEW").map((t) => ({ ...t, grant: g })));

  const fixDocs = (grantId: number) => {
    window.dispatchEvent(new CustomEvent("fg:fix-docs", { detail: { grantId } }));
    document.getElementById("documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  let tone = "border-zinc-200/80 bg-white";
  let icon = <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  let title = "You're all caught up";
  let body = "Nothing needs your attention right now. New milestones appear here as your funders open them.";
  let action: { label: string; run: () => void } | null = null;
  let note: string | null = null;

  if (ready) {
    tone = "border-slate-900 bg-white";
    icon = <Send className="h-5 w-5 text-slate-900" />;
    title = `Send your documents for Tranche ${ready.seq}: ${formatUsd(ready.amount_cents)}`;
    body = `${ready.funder} releases this payment after we check your receipt and attendance list. ${ready.status === "HELD" ? "Your last attempt was put on hold, so send corrected documents." : ""}`.trim();
    action = { label: "Start", run: () => onStart(ready.trancheId) };
    if (stuck) note = `Also needed for "${stuck.name}": ${stuck.compliance.blockingOutstanding} required document${stuck.compliance.blockingOutstanding === 1 ? "" : "s"} still missing.`;
  } else if (stuck) {
    tone = "border-rose-300 bg-rose-50";
    icon = <FileWarning className="h-5 w-5 text-rose-700" />;
    title = `Add ${stuck.compliance.blockingOutstanding} required document${stuck.compliance.blockingOutstanding === 1 ? "" : "s"} for "${stuck.name}"`;
    body = `${stuck.funder} needs ${stuck.compliance.blockingOutstanding === 1 ? "this" : "these"} on file before it can pay you. Payments for this grant are paused until then.`;
    action = { label: "Add documents", run: () => fixDocs(stuck.id) };
  } else if (sending.length) {
    tone = "border-sky-300 bg-sky-50";
    icon = <Clock className="h-5 w-5 text-sky-700" />;
    title = `Your payment of ${formatUsd(sending[0].amount_cents)} is on its way`;
    body = "PayPal is processing it. This page updates by itself when it arrives.";
  } else if (inReview.length) {
    tone = "border-amber-300 bg-amber-50";
    icon = <Clock className="h-5 w-5 text-amber-700" />;
    title = "A program officer is reviewing your documents";
    body = "You don't need to do anything unless they ask. You'll see the decision here.";
  }

  return (
    <section className={`mb-5 flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${tone}`} aria-label="Your next step">
      <span className="flex-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-zinc-500">Your next step</div>
        <h2 className="text-[17px] font-semibold leading-6 tracking-tight">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-zinc-600">{body}</p>
        {note && <p className="mt-1 text-[12px] font-medium text-rose-700">{note}</p>}
      </div>
      {action && <button className="btn-primary h-10 px-5 text-[14px]" onClick={action.run}>{action.label} <ArrowRight className="h-4 w-4" /></button>}
    </section>
  );
}
