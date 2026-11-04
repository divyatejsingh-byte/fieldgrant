"use client";
import { ArrowRight, CheckCircle2, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatUsd } from "@/lib/money";
import type { CohortCard, GrantmakerOverview } from "@/lib/overview";
import { useFunder } from "./AppState";
import { SectorBars, TrancheDonut, TrancheStrip } from "./charts";
import { ExecutiveUtilizationBar } from "./ExecutiveUtilizationBar";
import { DemoGuide } from "./DemoGuide";
import type { ReportRow } from "@/lib/reports";
import { LedgerGrid } from "./LedgerGrid";
import { SystemStatus } from "./SystemStatus";
import { Badge, DATA_CHANGED, ErrorBox, Hint, Panel, Skeleton, emitDataChanged, useApi } from "./ui";

const signed = (c: number) => (c < 0 ? `−${formatUsd(-c)}` : formatUsd(c));
const pct = (bps: number | null) => (bps === null ? "n/a" : `${(bps / 100).toFixed(1)}%`);

function Stat({ label, hint, value, sub, tone = "" }: { label: string; hint?: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-[13px] font-medium text-zinc-600">{label}{hint && <Hint text={hint} />}</div>
      <div className={`num mt-1 truncate text-[22px] font-semibold leading-8 ${tone}`}>{value}</div>
      <div className="mt-0.5 min-h-4 truncate text-[12px] text-zinc-500">{sub}</div>
    </div>
  );
}

/** The first thing the funder sees: what, if anything, needs a person. */
function Attention({ ov }: { ov: GrantmakerOverview | null }) {
  if (!ov) return <Skeleton className="mb-5 h-24 w-full" />;
  const waiting = ov.reviewCount;
  const held = ov.trancheHealth.HELD;
  const sending = ov.trancheHealth.RELEASING;
  const clear = waiting === 0 && held === 0;
  return (
    <section className={`mb-5 flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${clear ? "border-zinc-200/80 bg-white" : "border-amber-300 bg-amber-50"}`} aria-label="Needs your attention">
      <span className="flex-none">{clear ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ClipboardList className="h-5 w-5 text-amber-700" />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-zinc-500">Needs your attention</div>
        <h2 className="text-[17px] font-semibold leading-6 tracking-tight">
          {clear ? "Nothing needs you right now" : waiting > 0 ? `${waiting} submission${waiting === 1 ? " needs" : "s need"} your decision` : `${held} payment${held === 1 ? " is" : "s are"} on hold`}
        </h2>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-zinc-600">
          {clear ? "Everything submitted so far was checked and handled automatically." : "These couldn't be approved automatically. Open each one to see why, then approve it or keep it on hold."}
          {sending > 0 && ` ${sending} payment${sending === 1 ? " is" : "s are"} being sent by PayPal.`}
        </p>
      </div>
      {!clear && <Link href="/review" className="btn-primary h-10 px-5 text-[14px]">Open the review queue <ArrowRight className="h-4 w-4" /></Link>}
    </section>
  );
}

/** Which funder's books are on screen. The fiscal-year controls live in the capital allocation card. */
function FunderBar({ ov, setYear }: { ov: GrantmakerOverview | null; setYear: (y: number | null) => void }) {
  const { foundations, funder, funderId, setFunderId } = useFunder();
  return (
    <section className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Active funder">
      <label htmlFor="funder" className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Funder</label>
      <select id="funder" className="field h-9 w-auto min-w-56 text-[14px] font-medium" value={funderId} onChange={(e) => { setFunderId(e.target.value); setYear(null); }}>
        {foundations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      {funder && <span className="font-mono text-[11px] text-zinc-500">{funder.ngoCount} grantee{funder.ngoCount === 1 ? "" : "s"} · {funder.grantCount} grant{funder.grantCount === 1 ? "" : "s"}{ov ? ` · ${ov.utilization.label}` : ""}</span>}
    </section>
  );
}

function CohortCardView({ c }: { c: CohortCard }) {
  const done = c.counts.PAID;
  const total = c.tranches.length;
  const needsReview = c.counts.IN_REVIEW + c.counts.HELD;
  return (
    <article className="flex flex-col rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{c.ngo.name}</h3>
          <p className="truncate text-[12px] text-zinc-500">{c.ngo.sector} · {c.grants.length} {c.grants.length === 1 ? "grant" : "grants"} from you</p>
        </div>
        <span className="inline-flex h-5 flex-none items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[11px] font-medium text-zinc-700" title={c.ngo.country_label}>{c.ngo.country_code}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div><div className="text-[12px] text-zinc-600">Awarded</div><div className="num mt-0.5 text-[14px] font-medium">{formatUsd(c.awardedCents)}</div></div>
          <div><div className="text-[12px] text-zinc-600">Paid</div><div className="num mt-0.5 text-[14px] font-medium text-emerald-700">{formatUsd(c.paidCents)}</div></div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500"><span className="text-[12px] text-zinc-600">Progress</span><span className="num">{done} of {total} payments made</span></div>
          <TrancheStrip tranches={c.tranches} />
        </div>
        <div className="min-h-8 text-[12px] text-zinc-600">
          {c.active ? <span className="flex flex-wrap items-center gap-2">Now: <span className="num text-zinc-900">Tranche {c.active.seq}</span> <Badge status={c.active.status} /></span> : <span className="text-zinc-400">Nothing in progress.</span>}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
          {needsReview > 0 && <Link href="/review" className="btn-primary h-7 px-2.5 text-[12px]">Review submissions <span className="num">{needsReview}</span></Link>}
          {c.latestSubmission && <Link href={`/submissions/${c.latestSubmission.id}`} className="btn-secondary h-7 px-2.5 text-[12px]">See latest result</Link>}
          <Link href={`/ngo/${c.ngo.id}`} className="btn-secondary h-7 px-2.5 text-[12px]">Grants and documents <ArrowRight className="h-3 w-3" /></Link>
        </div>
      </div>
    </article>
  );
}

type Tab = "overview" | "grantees" | "history";
const TABS: { key: Tab; label: string }[] = [{ key: "overview", label: "Overview" }, { key: "grantees", label: "Grantees" }, { key: "history", label: "History" }];

/** The newest reports shared by grantees, with a way into all of them. */
function LatestReports({ funderId }: { funderId: string }) {
  const { data } = useApi<ReportRow[]>(funderId ? `/api/reports?foundation_id=${funderId}` : null, 15000);
  const rows = (data ?? []).slice(0, 4);
  return (
    <Panel title="Latest reports from grantees" right={<Link href="/reports" className="text-[12px] font-semibold text-emerald-700 hover:underline">See all{data ? ` (${data.length})` : ""}</Link>}>
      {rows.length === 0 ? <p className="text-[13px] text-zinc-500">No reports yet. Reports your grantees share appear here.</p> : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <li key={r.id}>
              <a href={`/api/reports/${r.id}/file`} target="_blank" rel="noreferrer" className="-mx-2 flex items-center gap-3 rounded px-2 py-2 text-[13px] transition-colors hover:bg-emerald-50">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800">{r.period_type === "MONTHLY" ? "Monthly" : r.period_type === "QUARTERLY" ? "Quarterly" : "Annual"} <span className="num">{r.period_label}</span></span>
                <span className="min-w-0 flex-1 truncate">{r.ngo_name} <span className="text-zinc-500">· {r.grant_name}</span></span>
                <span className="text-[12px] font-medium text-emerald-700">Open</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Grantmaker executive dashboard for the active funder. Every figure is scoped to that funder and its own FY model. */
export function GrantmakerDashboard() {
  const { funderId, funder } = useFunder();
  const [year, setYear] = useState<number | null>(null);
  const url = funderId ? `/api/grantmaker/overview?foundation_id=${funderId}${year === null ? "" : `&year=${year}`}` : null;
  const { data, error, loading, reload } = useApi<GrantmakerOverview>(url, 5000);
  const stale = data && String(data.foundation.id) !== funderId;
  const ov = data && !stale ? data : null;

  // Reactive: payouts, approvals and overrides emit this event, so figures refresh immediately (polling is the fallback).
  const refetch = useCallback(() => void reload(), [reload]);
  useEffect(() => {
    window.addEventListener(DATA_CHANGED, refetch);
    return () => window.removeEventListener(DATA_CHANGED, refetch);
  }, [refetch]);

  const u = ov?.utilization;
  const awaiting = !!u && u.floatCents < 0;
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      <DemoGuide />
      <FunderBar ov={ov} setYear={setYear} />
      <Attention ov={ov} />
      {error && <div className="mb-5"><ErrorBox message={error} /></div>}

      <div role="tablist" aria-label="Dashboard sections" className="mb-4 flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] font-semibold transition-colors ${tab === t.key ? "border-emerald-600 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
            {t.label}{t.key === "grantees" && ov ? <span className="num ml-1.5 text-[12px] font-normal text-zinc-400">{ov.cohort.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (<div className="fg-fade">
      <ExecutiveUtilizationBar ov={ov} year={year} setYear={setYear} />
      {/* Metric cards */}
      <section className="mb-4 rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Money at a glance">
        {!u ? <Skeleton className="h-[104px] w-full rounded-none" /> : (
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0">
            <Stat label="Promised this year" hint="Grants active in this reporting year. A grant that spans two years is split by days." value={formatUsd(u.committedCents)} sub={u.label} />
            <Stat label="Paid out via PayPal" hint="Payments sent to grantees this year (including ones still being delivered)." value={formatUsd(u.disbursedCents)} sub={`${pct(u.disbursedBps)} of what was promised`} tone="text-sky-800" />
            <Stat label="Spending proven with receipts" hint="Receipts that were checked and approved. This is the part of the money you can see was spent as agreed." value={formatUsd(u.utilizedCents)} sub={`${pct(u.utilizedBps)} of what was promised`} tone="text-emerald-700" />
            <Stat label={awaiting ? "Receipts approved, payment not sent" : "Paid out, receipts still due"} hint="Money already sent to grantees whose receipts have not yet been checked. It should shrink as grantees send their proof." value={signed(u.floatCents)} sub={awaiting ? "Waiting for payment to go out" : "Paid minus proven"} tone={awaiting ? "text-amber-700" : ""} />
          </div>
        )}
      </section>

      {/* Charts */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="By sector">{ov ? <SectorBars sectors={ov.sectors} /> : <Skeleton className="h-24 w-full" />}</Panel>
        <Panel title="Payment stages">{ov ? <TrancheDonut counts={ov.trancheHealth} /> : <Skeleton className="h-28 w-full" />}</Panel>
      </div>

      {funderId && <LatestReports funderId={funderId} />}
      <div className="mt-4 rounded-lg border border-zinc-200/80 bg-white px-4 py-2.5"><SystemStatus /></div>
      </div>)}

      {tab === "grantees" && (<div className="fg-fade">
      {/* Grantee cohort */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold tracking-tight">Your grantees{funder ? ` · ${funder.name}` : ""}</h2>
        <span className="text-[12px] text-zinc-500">{ov?.cohort.length ?? 0} funded {ov?.cohort.length === 1 ? "organisation" : "organisations"}</span>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && !ov && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        {ov?.cohort.map((c) => <CohortCardView key={c.ngo.id} c={c} />)}
      </div>

      </div>)}

      {tab === "history" && funderId && (<div className="fg-fade"><LedgerGrid key={funderId} foundationId={funderId} height="min(560px, calc(100vh - 300px))" title="History of every payment and decision" /></div>)}
    </>
  );
}
