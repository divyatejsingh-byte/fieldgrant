"use client";
import { ArrowRight, BarChart3, FileText, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { usePartnerDraft } from "@/components/AppState";
import { DemoGuide } from "@/components/DemoGuide";
import { PageHeader, useApi } from "@/components/ui";
import type { ReportRow } from "@/lib/reports";
import { ComplianceChecklist } from "./ComplianceChecklist";
import { FundingDetails, GranteeSummary } from "./GranteeOverview";
import { usePartner } from "./layout";
import { NextStep } from "./NextStep";

const now = new Date();
const QUARTER = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;

function Tile({ href, icon, tone, title, line, cta }: { href: string; icon: ReactNode; tone: string; title: string; line: ReactNode; cta: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-lg border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>{icon}</span>
      <div className="mt-3 text-[15px] font-semibold">{title}</div>
      <div className="mt-0.5 flex-1 text-[13px] leading-5 text-zinc-600">{line}</div>
      <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">{cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
    </Link>
  );
}

/** Grantee home: the one next step, three numbers, and doors to the three things a grantee does. Detail lives on its own page. */
export default function PartnerHome() {
  const { ngoId, overview: o } = usePartner();
  const { patch } = usePartnerDraft();
  const router = useRouter();
  const reports = useApi<ReportRow[]>(ngoId ? `/api/reports?ngo_id=${ngoId}` : null, 15000);

  const stats = useMemo(() => {
    const grants = (o?.funders ?? []).flatMap((f) => f.grants);
    const tranches = grants.flatMap((g) => g.tranches);
    const waiting = (o?.funders ?? []).reduce((n, f) => n + f.actionable.length, 0);
    const paid = tranches.filter((t) => t.status === "PAID").length;
    const dueReports = grants.filter((g) => !(reports.data ?? []).some((r) => r.grant_id === g.id && r.period_type === "QUARTERLY" && r.period_label === QUARTER)).length;
    return { waiting, paid, total: tranches.length, dueReports, grants: grants.length };
  }, [o, reports.data]);

  const start = (id: number) => { patch({ trancheId: String(id), submissionId: null, snap: null }); router.push("/partner/submit"); };

  return (
    <>
      <PageHeader title="Your funding" sub="What you've received, what to do next, and where to go from here." />
      <DemoGuide />
      <NextStep onStart={start} />
      <GranteeSummary />
      <ComplianceChecklist />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Tile href="/partner/submit" icon={<FileText className="h-4.5 w-4.5" />} tone="bg-emerald-100 text-emerald-700" title="Send documents"
          line={stats.waiting > 0 ? <>{stats.waiting} payment{stats.waiting === 1 ? " is" : "s are"} waiting for your receipt and proof of work.</> : "Nothing is waiting for documents right now."} cta="Open" />
        <Tile href="/partner/reports" icon={<BarChart3 className="h-4.5 w-4.5" />} tone="bg-slate-100 text-slate-700" title="Reports"
          line={stats.dueReports > 0 ? <>{stats.dueReports} quarterly report{stats.dueReports === 1 ? " is" : "s are"} due for <span className="num font-medium">{QUARTER}</span>. Your funder sees what you share.</> : <>Your <span className="num font-medium">{QUARTER}</span> reports are in.</>} cta="Share a report" />
        <Tile href="/partner/tranches" icon={<Wallet className="h-4.5 w-4.5" />} tone="bg-emerald-100 text-emerald-700" title="My payments"
          line={<>{stats.paid} of {stats.total} payments received across {stats.grants} grant{stats.grants === 1 ? "" : "s"}.</>} cta="See all payments" />
      </div>

      <FundingDetails />
    </>
  );
}
