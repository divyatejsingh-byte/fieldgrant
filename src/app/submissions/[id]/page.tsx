"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Inspection } from "@/components/Inspection";
import { useRole } from "@/components/role";
import type { SubmissionDetail } from "@/components/types";
import { Badge, ErrorBox, Money, PageHeader, Panel, Skeleton, useApi } from "@/components/ui";

export default function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const role = useRole();
  const { data: d, error, loading, reload } = useApi<SubmissionDetail>(`/api/submissions/${id}`);
  if (loading && !d) return <Skeleton className="h-96 w-full" />;
  if (error || !d) return <ErrorBox message={error ?? "Not found"} />;
  return (
    <>
      <Link href={role === "ngo" ? "/partner/tranches" : `/ngo/${d.ngo.id}`} className="mb-3 inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-3 w-3" /> {role === "ngo" ? "My tranches" : d.ngo.name}</Link>
      <PageHeader
        title={`Submission #${d.id}`}
        sub={`${d.grant.name} · Tranche ${d.tranche.seq}`}
        right={<div className="flex items-center gap-3 text-[12px]"><Money cents={d.tranche.amount_cents} className="text-[14px] font-medium" /><Badge status={d.tranche.status} /></div>}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Inspection d={d} onChange={reload} role={role} />
        <Panel title="Audit trail" flush>
          <ol className="divide-y divide-zinc-100">
            {d.ledger.map((e) => (
              <li key={e.id} className="px-4 py-2.5 text-[12px]">
                <div className="flex flex-wrap items-center gap-2"><span className="num font-medium">{e.event_type}</span><Badge status={e.status} /><span className="text-zinc-400">{e.actor}</span></div>
                <div className="num mt-0.5 text-[11px] text-zinc-500">{e.created_at}</div>
                {e.event_type === "PAYOUT_FAILED" && <div className="mt-1 text-rose-700">{e.payload.message}</div>}
                {e.event_type === "OFFICER_OVERRIDE" && <div className="mt-1 text-zinc-700">{e.payload.previous_decision} → {e.payload.new_decision}: {e.payload.reason}</div>}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
