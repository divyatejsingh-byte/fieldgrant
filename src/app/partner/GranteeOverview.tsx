"use client";
import { ChevronRight } from "lucide-react";
import { DeploymentBar, TrancheStrip } from "@/components/charts";
import { Badge, Hint, Skeleton } from "@/components/ui";
import { formatUsd } from "@/lib/money";
import type { FunderFacility } from "@/lib/overview";
import { usePartner } from "./layout";

const signed = (c: number) => (c < 0 ? `−${formatUsd(-c)}` : formatUsd(c));
const pct = (bps: number | null) => (bps === null ? "" : `${(bps / 100).toFixed(0)}%`);

function Stat({ label, hint, value, sub, tone = "" }: { label: string; hint: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-[13px] font-medium text-zinc-600">{label}<Hint text={hint} /></div>
      <div className={`num mt-1 truncate text-[22px] font-semibold leading-8 ${tone}`}>{value}</div>
      <div className="mt-0.5 min-h-4 truncate text-[12px] text-zinc-500">{sub}</div>
    </div>
  );
}

/** Three plain headline numbers. */
export function GranteeSummary() {
  const { overview: o } = usePartner();
  if (!o) return <Skeleton className="mb-5 h-[104px] w-full" />;
  const grants = o.funders.reduce((n, f) => n + f.grants.length, 0);
  return (
    <section className="mb-5 rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Your funding at a glance">
      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="Total awarded" hint="Everything your funders have promised you, across all grants." value={formatUsd(o.totals.awardedCents)} sub={`${grants} grant${grants === 1 ? "" : "s"} from ${o.funders.length} funder${o.funders.length === 1 ? "" : "s"}`} />
        <Stat label="Money received" hint="Payments PayPal has already delivered to you." value={formatUsd(o.totals.receivedCents)} sub="Paid to your PayPal account" tone="text-emerald-700" />
        <Stat label="Waiting on you" hint="Payments you can unlock by sending documents, or that are being reviewed or sent right now. Payments for later stages open automatically as you go." value={formatUsd(o.totals.pendingLiquidityCents)} sub="Ready once documents are checked" tone="text-amber-700" />
      </div>
    </section>
  );
}

/** One funder's detail card. Every number is in THAT funder's own reporting year, not the grantee's local one. */
function Facility({ f }: { f: FunderFacility }) {
  const u = f.utilization;
  return (
    <article className="flex flex-col rounded-lg border border-zinc-200/80 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <h3 className="text-[15px] font-semibold tracking-tight">{f.foundation.name}</h3>
        <span className="inline-flex h-6 items-center rounded border border-zinc-200 bg-zinc-50 px-2 text-[12px] text-zinc-700" title={`${f.range.start} to ${f.range.end}`}>
          Reporting year {f.fyMonths}<Hint text="Each funder keeps its books on its own calendar. These numbers follow this funder's year, so they may differ from other funders'." />
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div><div className="text-[12px] text-zinc-600">Promised</div><div className="num mt-0.5 text-[15px] font-medium">{formatUsd(u.committedCents)}</div></div>
          <div><div className="text-[12px] text-zinc-600">Received</div><div className="num mt-0.5 text-[15px] font-medium text-sky-800">{formatUsd(u.disbursedCents)}</div><div className="num text-[11px] text-zinc-500">{pct(u.disbursedBps)}</div></div>
          <div><div className="text-[12px] text-zinc-600">Receipts proven<Hint text="The part of what you received that your submitted receipts have already shown was spent as agreed." /></div><div className="num mt-0.5 text-[15px] font-medium text-emerald-700">{formatUsd(u.utilizedCents)}</div><div className="num text-[11px] text-zinc-500">{pct(u.utilizedBps)}</div></div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-zinc-600">
            <span>Progress</span>
            <span className="num text-[11px] text-zinc-500">{u.floatCents < 0 ? `receipts ahead of payment by ${signed(-u.floatCents)}` : u.floatCents > 0 ? `${formatUsd(u.floatCents)} paid, receipts still due` : "all receipts in"}</span>
          </div>
          <DeploymentBar bar={u.bar} committedCents={u.committedCents} dense />
        </div>
        <ul className="space-y-2.5 border-t border-zinc-100 pt-3">
          {f.grants.map((g) => {
            const missing = g.compliance.covenants.filter((c) => !c.passed).length;
            return (
              <li key={g.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]"><span className="truncate font-medium text-zinc-800">{g.name}</span><span className="num flex-none text-zinc-500">{formatUsd(g.total_cents)}</span></div>
                {g.compliance.covenants.length > 0 && (
                  <div className={`mb-1 text-[12px] ${g.compliance.blockingOutstanding ? "text-rose-700" : missing ? "text-amber-700" : "text-emerald-700"}`}>
                    {missing === 0 ? `All ${g.compliance.covenants.length} required documents are on file` : `${missing} required document${missing === 1 ? "" : "s"} missing${g.compliance.blockingOutstanding ? " (payments paused)" : ""}`}
                  </div>
                )}
                <TrancheStrip tranches={g.tranches} />
                <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-zinc-500">
                  {g.tranches.map((t) => <span key={t.id} className="flex items-center gap-1">Tranche {t.seq} <Badge status={t.status} /></span>)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

/** Funder-by-funder numbers, tucked away until wanted. */
export function FundingDetails() {
  const { overview: o } = usePartner();
  if (!o) return null;
  return (
    <details className="group mb-6 rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-90" />
        Funding details by funder
        <span className="text-[12px] font-normal text-zinc-500">promised, received and receipts proven, for each of your {o.funders.length} funders</span>
      </summary>
      <div className="grid gap-4 border-t border-zinc-200 p-4 md:grid-cols-2">
        {o.funders.map((f) => <Facility key={f.foundation.id} f={f} />)}
      </div>
    </details>
  );
}
