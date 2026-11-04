"use client";
import { AlertTriangle, Check } from "lucide-react";
import type { Consensus, ConsensusRow } from "@/lib/consensus";
import { formatUsd } from "@/lib/money";

const micro = "text-[10px] font-mono uppercase tracking-wider text-zinc-500";
const show = (r: ConsensusRow, v: string | null) => (v === null ? "not read" : r.kind === "money" ? formatUsd(Number(v)) : v);

/**
 * Side-by-side view of the two independent reads of the same documents. Matching values are the evidence that the reading is
 * stable; any difference, or text in a document that tried to instruct the AI, is what routes a submission to a person.
 */
export function ConsensusDiff({ c, reasons, decision }: { c: Consensus; reasons: string[]; decision: string | null }) {
  const diffs = c.rows.filter((r) => !r.match);
  const routed = decision === "OFFICER_REVIEW";
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white" aria-label="Extraction consensus">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5">
        <div><div className={micro}>Dual-pass consensus</div><div className="mt-0.5 text-[14px] font-semibold">Two independent reads of the same documents</div></div>
        {c.available && (
          diffs.length === 0
            ? <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />All fields confirmed</span>
            : <span className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{diffs.length} field{diffs.length === 1 ? "" : "s"} differ</span>
        )}
      </header>

      {!c.available ? (
        <div className="flex items-start gap-2 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          One or both reads could not be used ({c.failed.filter(Boolean).join(" and ")}). A failed read is never retried; the submission goes to a person.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[13px] [&_td]:border [&_td]:border-zinc-200/80 [&_th]:border [&_th]:border-zinc-200/80 [&_td:first-child]:border-l-0 [&_td:last-child]:border-r-0 [&_th:first-child]:border-l-0 [&_th:last-child]:border-r-0">
            <thead><tr className="border-b border-zinc-200 text-left"><th className={`${micro} px-4 py-2 font-normal`}>Field</th><th className={`${micro} px-3 py-2 font-normal`}>Run 1</th><th className={`${micro} px-3 py-2 font-normal`}>Run 2</th><th className={`${micro} px-4 py-2 font-normal`}>Result</th></tr></thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.key} className={`border-b border-zinc-100 last:border-0 ${r.match ? "" : "bg-amber-50/60"}`}>
                  <td className="px-4 py-2 text-zinc-600">{r.label}</td>
                  <td className="px-3 py-2 font-mono text-[12px] tabular-nums">{show(r, r.a)}</td>
                  <td className="px-3 py-2 font-mono text-[12px] tabular-nums">{show(r, r.b)}</td>
                  <td className="px-4 py-2">
                    {r.match
                      ? <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700"><Check className="h-3 w-3" />Confirmed (0% variance)</span>
                      : <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-amber-700"><AlertTriangle className="h-3 w-3" />{r.variancePct !== null ? `Variance ${r.variancePct}%` : "Mismatch"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(diffs.length > 0 || !c.available || c.injectionFlagged || routed) && (
        <div className="space-y-1.5 border-t border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-900">
          {routed && <div className="font-semibold">Routed to OFFICER_REVIEW. The model is never the judge: when two reads disagree, or a document tries to instruct the AI, a person decides.</div>}
          {diffs.length > 0 && <div>The two reads disagreed on: {diffs.map((d) => d.label.toLowerCase()).join(", ")}.</div>}
          {c.injectionFlagged && <div>A document contained text aimed at an AI (for example an instruction to approve). It was flagged and treated as data, never obeyed.</div>}
          {reasons.length > 0 && <ul className="list-disc pl-5">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}
