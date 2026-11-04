"use client";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { covenantSource } from "@/lib/compliance-catalog";
import type { CovenantRow } from "@/lib/compliance";
import { CovenantEditor } from "./CovenantEditor";
import { Badge, Skeleton, useApi } from "./ui";

type Resp = { grant: { id: number }; rows: CovenantRow[]; passed: boolean; blockingOutstanding: number };

/** Grantmaker view of one grant's covenants against the grantee vault, with the editor behind one button. */
export function GrantCompliance({ grantId }: { grantId: number }) {
  const { data, reload } = useApi<Resp>(`/api/grants/${grantId}/compliance`, 10000);
  const [editing, setEditing] = useState(false);
  if (!data) return <div className="border-t border-zinc-200 p-4"><Skeleton className="h-16 w-full" /></div>;
  const outstanding = data.rows.filter((r) => !r.passed).length;

  return (
    <div className="border-t border-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="label !text-zinc-900">Compliance covenants</span>
          <span className="num text-[11px] text-zinc-500">{data.rows.length === 0 ? "none set" : outstanding === 0 ? `${data.rows.length} satisfied` : `${outstanding} of ${data.rows.length} outstanding`}</span>
          {data.blockingOutstanding > 0 && <span className="rounded border border-rose-200 bg-rose-50 px-1.5 font-mono text-[10px] font-semibold uppercase text-rose-700">Gate 1 blocks payout</span>}
        </div>
        <button type="button" className="btn-secondary h-7 px-2.5 text-[12px]" onClick={() => setEditing(true)}><SlidersHorizontal className="h-3.5 w-3.5" /> Edit covenants</button>
      </div>
      {data.rows.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {data.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[12px]">
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{r.name}</span>
              <span className="text-zinc-500">{covenantSource(r)}</span>
              <span className={`font-mono text-[10px] uppercase ${r.blocking ? "text-zinc-700" : "text-zinc-400"}`}>{r.blocking ? "Blocks payout" : "Advisory"}</span>
              <span className="w-20"><Badge status={r.state} /></span>
            </li>
          ))}
        </ul>
      )}
      {editing && <CovenantEditor grantId={grantId} onClose={() => setEditing(false)} onSaved={() => void reload()} />}
    </div>
  );
}
