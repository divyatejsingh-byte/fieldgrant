"use client";
import type { ReactNode } from "react";
import type { Band } from "./types";
import { Badge, Money } from "./ui";

export type GuardrailTranche = {
  amount_cents: number;
  requirements: { tolerance_pct: number; required_attendees: number; budget_line_cents: number; budget_line_label: string };
} | null;

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <div className="label">{label}</div>
      <div className="mt-0.5 flex min-h-5 items-center gap-1.5 text-[13px] font-medium">{children}</div>
    </div>
  );
}

/** Compliance-policy strip for the NGO view: the rules this tranche is judged against. Every value is real. */
export function GuardrailBanner({ tranche, band }: { tranche: GuardrailTranche; band: Band | null }) {
  const r = tranche?.requirements;
  const cap = r ? Math.floor((r.budget_line_cents * (100 + r.tolerance_pct)) / 100) : null;
  return (
    <section className="mb-5 grid grid-cols-2 divide-x divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200/80 bg-white lg:grid-cols-4 lg:divide-y-0" aria-label="Compliance policy for this tranche">
      <Cell label="Decision band">{band ? <Badge status={band} /> : <span className="text-zinc-400">Awaiting evidence</span>}</Cell>
      <Cell label="Tranche to release"><Money cents={tranche?.amount_cents} /><span className="text-[11px] font-normal text-zinc-400">USD</span></Cell>
      <Cell label="Receipt limit">
        <Money cents={cap} />
        {r && <span className="truncate text-[11px] font-normal text-zinc-400">{r.budget_line_label}, +{r.tolerance_pct}% tolerance</span>}
      </Cell>
      <Cell label="Proof of work required">{r ? (r.required_attendees > 0 ? <><span className="num">{r.required_attendees}</span><span className="text-[11px] font-normal text-zinc-400">attendees minimum</span></> : <span className="text-zinc-400">None</span>) : "-"}</Cell>
    </section>
  );
}
