"use client";
import { AlertTriangle, ChevronRight, CircleCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Hint, Skeleton } from "@/components/ui";
import { covenantSource } from "@/lib/compliance-catalog";
import type { CovenantRow } from "@/lib/compliance";
import { DocumentModal } from "./DocumentModal";
import { usePartner } from "./layout";

/** Grantee: which documents each grant requires, whether they are on file, and one click to fix any that are not. */
export function ComplianceChecklist() {
  const { ngoId, overview: o, reloadOverview } = usePartner();
  const [sel, setSel] = useState<number | null>(null);
  const [fixing, setFixing] = useState<CovenantRow | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);

  const grants = useMemo(() => (o?.funders ?? []).flatMap((f) => f.grants.map((g) => ({ ...g, funder: f.foundation.name }))), [o]);
  const names = useMemo(() => Object.fromEntries(grants.flatMap((g) => g.compliance.covenants.map((c) => [c.id, c.name]))), [grants]);
  const outstanding = grants.reduce((n, g) => n + g.compliance.covenants.filter((c) => !c.passed).length, 0);

  // Open by default only when something needs fixing; the "Your next step" card can jump straight to a grant.
  useEffect(() => { if (o && open === null) setOpen(outstanding > 0); }, [o, open, outstanding]);
  useEffect(() => {
    const h = (e: Event) => { setSel((e as CustomEvent<{ grantId: number }>).detail.grantId); setOpen(true); };
    window.addEventListener("fg:fix-docs", h);
    return () => window.removeEventListener("fg:fix-docs", h);
  }, []);

  if (!o) return <Skeleton className="mb-6 h-16 w-full" />;
  if (grants.length === 0) return null;
  // Default to the first grant that still has something to fix, otherwise the first grant.
  const active = grants.find((g) => g.id === sel) ?? grants.find((g) => !g.compliance.passed) ?? grants[0];
  const rows = active.compliance.covenants;
  const blocking = active.compliance.blockingOutstanding;

  return (
    <details id="documents" open={!!open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="group mb-6 scroll-mt-20 rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-90" />
        Required documents
        <Hint text="Each funder asks you to keep certain documents on file (for example registration certificates). We check them before reading any receipt, so a missing one pauses payments for that grant." />
        {outstanding === 0
          ? <span className="inline-flex items-center gap-1 text-[12px] font-normal text-emerald-700"><CircleCheck className="h-3.5 w-3.5" /> all on file</span>
          : <span className="text-[12px] font-normal text-rose-700">{outstanding} missing or expired</span>}
      </summary>

      <div className="border-t border-zinc-200">
        <div role="tablist" aria-label="Grant" className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {grants.map((g) => (
            <button key={g.id} role="tab" aria-selected={g.id === active.id} onClick={() => setSel(g.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${g.id === active.id ? "border-slate-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
              {g.funder} <span className="text-zinc-400">·</span> <span className="max-w-[200px] truncate">{g.name}</span>
              {!g.compliance.passed && <span className={`h-1.5 w-1.5 rounded-full ${g.compliance.blockingOutstanding ? "bg-rose-500" : "bg-amber-500"}`} aria-label="Documents outstanding" />}
            </button>
          ))}
        </div>

        {blocking > 0 && (
          <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800" role="status">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>Payments for this grant are paused until you add {blocking === 1 ? "the 1 document" : `the ${blocking} documents`} marked <b>Missing</b> or <b>Expired</b> below. Your receipts aren&apos;t read until then.</span>
          </div>
        )}

        {rows.length === 0 ? <p className="px-4 py-6 text-[14px] text-zinc-500">This grant doesn&apos;t require any documents.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="border-b border-zinc-200 text-left"><th className="label px-4 py-2">Document</th><th className="label py-2">Required by</th><th className="label py-2">Status</th><th className="label py-2">On file</th><th className="px-4" /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 align-top last:border-0">
                    <td className="px-4 py-3"><div className="font-medium">{r.name}</div>{r.description && <div className="max-w-md text-[12px] text-zinc-500">{r.description}</div>}</td>
                    <td className="py-3 pr-3 text-[13px] text-zinc-600">{covenantSource(r)}{!r.blocking && <div className="text-[12px] text-zinc-400">Won&apos;t pause payments</div>}</td>
                    <td className="py-3 pr-3"><Badge status={r.state} /></td>
                    <td className="py-3 pr-3 text-[12px] text-zinc-600"><span className="num">{r.docNumber ?? (r.fileName ? "uploaded copy" : "-")}</span>{r.expiryDate && <div className="text-zinc-400">expires {r.expiryDate}</div>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" className={r.passed ? "btn-secondary h-8 px-3" : "btn-primary h-8 px-3"} onClick={() => { setSel(active.id); setFixing(r); }}>
                        {r.state === "MISSING" ? (r.isCustom ? "Link or upload" : "Add document") : r.passed ? "Replace" : "Renew"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-zinc-100 px-4 py-2.5 text-[12px] text-zinc-500">
          Documents you add are reused by every grant that needs them. We check that a document is on file and hasn&apos;t expired; we don&apos;t verify it with any official registry.
        </p>
      </div>
      {fixing && <DocumentModal ngoId={ngoId} row={fixing} vault={o.vault} names={names} onClose={() => setFixing(null)} onDone={reloadOverview} />}
    </details>
  );
}
