"use client";
import { covenantSource } from "@/lib/compliance-catalog";
import type { CovenantRow } from "@/lib/compliance";
import { Badge, Skeleton, useApi } from "./ui";

type Resp = { grant: { id: number }; rows: CovenantRow[]; passed: boolean; blockingOutstanding: number };
const micro = "text-[10px] font-mono uppercase tracking-wider text-zinc-500";

/**
 * "Gate 1: Statutory & Covenant Clearance". The documents this grant requires, checked against the grantee's vault before any
 * receipt is read. Vault entries are self-declared (reference numbers are shown as typed by the grantee and are never verified).
 */
export function GateCard({ grantId, note }: { grantId: number; note?: string }) {
  const { data } = useApi<Resp>(`/api/grants/${grantId}/compliance`, 15000);
  if (!data) return <Skeleton className="h-24 w-full" />;
  if (data.rows.length === 0) return null;
  const ok = data.rows.filter((r) => r.passed).length;
  const blocked = data.blockingOutstanding > 0;
  return (
    <section className={`overflow-hidden rounded-lg border bg-white ${blocked ? "border-rose-200" : "border-zinc-200"}`} aria-label="Gate 1 statutory and covenant clearance">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5">
        <div><div className={micro}>Gate 1 · runs before any document is read</div><div className="mt-0.5 text-[14px] font-semibold">Statutory &amp; covenant clearance</div></div>
        <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${blocked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${blocked ? "bg-rose-500" : "bg-emerald-500"}`} />{blocked ? "Payout blocked" : "Cleared"} · {ok}/{data.rows.length}
        </span>
      </header>
      <ul className="divide-y divide-zinc-100">
        {data.rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-zinc-900">{r.name}</div>
              <div className="font-mono text-[11px] text-zinc-500">
                {covenantSource(r)}{r.blocking ? " · blocks payout" : " · advisory"}
                {r.docNumber ? ` · ${r.docNumber}` : ""}{r.expiryDate ? ` · exp ${r.expiryDate.slice(0, 7)}` : ""}
              </div>
            </div>
            <Badge status={r.state} />
          </li>
        ))}
      </ul>
      {(blocked || note) && <p className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-[12px] leading-4 text-zinc-600">{blocked ? "A required document is missing or expired, so payment is held and receipts are not read until it is added. " : ""}{note}</p>}
    </section>
  );
}
