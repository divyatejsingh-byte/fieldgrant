"use client";
import Link from "next/link";
import { useEffect } from "react";
import { GrantCompliance } from "./GrantCompliance";
import { Badge, ErrorBox, Money, Panel, Skeleton, useApi } from "./ui";

type Tranche = { id: number; seq: number; amount_cents: number; status: string; requirements: { required_attendees: number; budget_line_label: string; budget_line_cents: number; tolerance_pct: number }; latestSubmissionId: number | null };
export type NgoDetailData = { ngo: { id: number; name: string; sector: string; country_label: string }; grants: { id: number; name: string; foundation_name: string; total_cents: number; start_date: string; end_date: string; spend_cap_cents: number; tranches: Tranche[] }[] };

/** Grants and tranches for one NGO. `partner` swaps the foundation-only links for the NGO's own submit action. */
export function NgoDetail({ id, partner = false, foundationId, onData }: { id: string; partner?: boolean; foundationId?: string; onData?: (d: NgoDetailData) => void }) {
  const { data, error, loading } = useApi<NgoDetailData>(`/api/ngos/${id}${foundationId ? `?foundation_id=${foundationId}` : ""}`, 10000);
  useEffect(() => { if (data) onData?.(data); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorBox message={error ?? "Not found"} />;
  return (
    <div className="space-y-4">
      {data.grants.map((g) => (
        <Panel key={g.id} title={g.name} right={<span className="text-[12px] text-zinc-500">{g.foundation_name}</span>} flush>
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-b border-zinc-200 px-4 py-2.5 text-[12px]">
            <span><span className="label mr-2">Total</span><Money cents={g.total_cents} /></span>
            <span><span className="label mr-2">Spend cap</span><Money cents={g.spend_cap_cents} /></span>
            <span><span className="label mr-2">Window</span><span className="num">{g.start_date} to {g.end_date}</span></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-zinc-200 text-left"><th className="label px-4 py-2">Tranche</th><th className="label py-2 text-right">Amount</th><th className="label py-2 pl-6">Requirements</th><th className="label py-2">Status</th><th className="px-4" /></tr></thead>
              <tbody>
                {g.tranches.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <td className="num px-4 py-2.5">#{t.seq}</td>
                    <td className="py-2.5 text-right"><Money cents={t.amount_cents} /></td>
                    <td className="py-2.5 pl-6 text-zinc-600">
                      {t.requirements.required_attendees > 0 && <><span className="num">{t.requirements.required_attendees}</span> attendees · </>}
                      {t.requirements.budget_line_label} <Money cents={t.requirements.budget_line_cents} /> (±{t.requirements.tolerance_pct}%)
                    </td>
                    <td className="py-2.5"><Badge status={t.status} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-[12px]">
                      {partner && ["PENDING_EVIDENCE", "HELD"].includes(t.status) && <Link className="font-medium text-slate-900 underline underline-offset-2" href={`/partner?tranche=${t.id}`}>Submit evidence</Link>}
                      {t.latestSubmissionId && <Link className="ml-3 text-zinc-500 hover:text-zinc-900" href={`/submissions/${t.latestSubmissionId}`}>Latest result</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!partner && <GrantCompliance grantId={g.id} />}
        </Panel>
      ))}
    </div>
  );
}
