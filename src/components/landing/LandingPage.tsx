"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatUsd } from "@/lib/money";
import type { FoundationSummary } from "@/lib/foundations";
import type { GranteeOverview, GrantmakerOverview } from "@/lib/overview";
import { useApi } from "../ui";
import { chooseRole, Footer, Nav } from "./site";

const micro = "font-mono text-[10px] uppercase tracking-wider";

/** One labelled figure on a portal card. Values come from the live database; "-" while loading or unavailable. */
function Fig({ label, value, dark }: { label: string; value: ReactNode; dark?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`${micro} text-zinc-500`}>{label}</div>
      <div className={`mt-1 truncate font-mono text-[18px] font-semibold tabular-nums leading-6 ${dark ? "text-white" : "text-zinc-900"}`}>{value}</div>
    </div>
  );
}

/** Left portal: the funder's terminal, dark institutional surface. */
function GrantmakerPortal() {
  const f = useApi<FoundationSummary[]>("/api/foundations");
  const funder = f.data?.[0];
  const ov = useApi<GrantmakerOverview>(funder ? `/api/grantmaker/overview?foundation_id=${funder.id}` : null);
  const u = ov.data?.utilization;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0A0D14] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
        <span className={`${micro} truncate text-zinc-400`}>{funder ? `${funder.name} (${funder.countryCode})` : "Funder"} <span className="text-zinc-600">&bull;</span> {u ? `${u.label} ${u.model.replace("_", " ")}` : "FY"}</span>
        <span className={`${micro} flex-none rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-400`}>Grantmaker</span>
      </header>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[20px] font-semibold tracking-tight">Grantmaker Terminal</h3>
        <p className="mt-1 text-[13px] leading-5 text-zinc-400">Capital committed, disbursed and proven in your own fiscal year. Only the exceptions reach you.</p>
        <div className="mt-5 grid grid-cols-3 gap-4 border-y border-zinc-800 py-4">
          <Fig dark label="Committed" value={u ? formatUsd(u.committedCents) : "-"} />
          <Fig dark label="Utilized" value={u ? (u.utilizedBps === null ? "n/a" : `${Math.round(u.utilizedBps / 100)}%`) : "-"} />
          <Fig dark label="Pending review" value={ov.data ? `${ov.data.reviewCount} tranche${ov.data.reviewCount === 1 ? "" : "s"}` : "-"} />
        </div>
        <div className="mt-4" aria-label="Portfolio progress">
          <div className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500"><span>Portfolio paid out</span><span className="text-zinc-300">{u ? `${formatUsd(u.disbursedCents)} of ${formatUsd(u.committedCents)}` : "-"}</span></div>
          <div className="flex h-1.5 gap-px overflow-hidden rounded-sm bg-zinc-800">
            <div className="bg-emerald-500" style={{ width: `${u && u.committedCents > 0 ? (u.utilizedCents * 100) / u.committedCents : 0}%` }} />
            <div className="bg-emerald-800" style={{ width: `${u && u.committedCents > 0 ? ((u.disbursedCents - u.utilizedCents) * 100) / u.committedCents : 0}%` }} />
          </div>
        </div>
        <Link href="/portfolio" onClick={chooseRole("foundation")} className="group mt-5 inline-flex h-11 items-center justify-between rounded-md bg-white px-4 text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-200">
          Launch Grantmaker Terminal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

/** Right portal: the grantee's workspace, crisp light surface. */
function GranteePortal() {
  const n = useApi<{ id: number; name: string }[]>("/api/ngos");
  const org = n.data?.find((x) => /cleanwater/i.test(x.name)) ?? n.data?.[0];
  const ov = useApi<GranteeOverview>(org ? `/api/grantee/overview?ngo_id=${org.id}` : null);
  const o = ov.data;
  const next = o?.funders.flatMap((x) => x.actionable)[0];
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200/80 px-5 py-3">
        <span className={`${micro} truncate text-zinc-500`}>{o ? `${o.ngo.name} (${o.ngo.country_code})` : "Organization"} <span className="text-zinc-300">&bull;</span> {o ? o.ngo.country_label : ""}</span>
        <span className={`${micro} flex-none rounded border border-zinc-200 px-1.5 py-0.5 text-zinc-500`}>Grantee</span>
      </header>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[20px] font-semibold tracking-tight">Grantee Workspace</h3>
        <p className="mt-1 text-[13px] leading-5 text-zinc-600">Send a receipt and proof of work, get a clear answer in seconds, and track every payment from every funder.</p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-zinc-200/80 py-4">
          <Fig label="Active grants" value={o ? formatUsd(o.totals.awardedCents) : "-"} />
          <Fig label="Current action" value={o ? (next ? <span className="text-[14px]">Tranche {next.seq} proof due ({formatUsd(next.amount_cents)})</span> : <span className="text-[14px]">Nothing due</span>) : "-"} />
        </div>
        <Link href="/partner" onClick={chooseRole("ngo")} className="group mt-5 inline-flex h-11 items-center justify-between rounded-md bg-slate-900 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800">
          Launch Grantee Submission Workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

const PIPELINE = [
  ["1", "Multimodal Zod Extraction", "AI reads documents into a strict schema", "/how-it-works"],
  ["2", "10-Check Deterministic Engine", "Plain code decides: release, review or hold", "/rules"],
  ["3", "Idempotent PayPal Batch", "One payout per tranche, signature-verified", "/history"],
] as const;

function Hero() {
  return (
    <section className="border-b border-zinc-200/80 bg-[#F9FAFB]">
      <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-700">Programmatic grant liquidity &amp; compliance</div>
        <h1 className="mt-3 max-w-4xl text-[36px] font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-[52px]">Autonomous capital rails for institutional philanthropy.</h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-7 text-zinc-600">AI extracts evidence into strict data schemas. Deterministic code enforces covenants. PayPal Payouts dispatches funds in seconds.</p>

        <div id="gateway" className="mt-8 grid scroll-mt-24 gap-4 md:grid-cols-2">
          <GrantmakerPortal />
          <GranteePortal />
        </div>

        <ol className="mt-4 grid overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:grid-cols-3" aria-label="Pipeline">
          {PIPELINE.map(([n, title, sub, href], i) => (
            <li key={n} className="relative border-b border-zinc-200/80 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <Link href={href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50">
                <span className="grid h-6 w-6 flex-none place-items-center rounded border border-zinc-300 font-mono text-[11px] font-medium text-zinc-700 transition-colors group-hover:border-emerald-600 group-hover:text-emerald-700">{n}</span>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] font-medium text-zinc-900">{title}</div>
                  <div className="truncate text-[12px] text-zinc-500">{sub}</div>
                </div>
              </Link>
              {i < PIPELINE.length - 1 && <ArrowRight className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-white text-zinc-400 md:block" aria-hidden />}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-zinc-500">
          <span>No login. PayPal sandbox only: no real money moves.</span>
          {[["Architecture", "/how-it-works"], ["Verification Rules", "/rules"], ["Audit Ledger", "/history"], ["Vision", "/vision"]].map(([l, h]) => <Link key={h} href={h} className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">{l}</Link>)}
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ githubUrl }: { version?: string; githubUrl: string | null }) {
  return (
    <div className="bg-[#F9FAFB] text-slate-900">
      <Nav githubUrl={githubUrl} minimal />
      <Hero />
      <Footer />
    </div>
  );
}
