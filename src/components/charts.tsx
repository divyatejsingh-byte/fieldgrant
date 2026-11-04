"use client";
// Small, dependency-free SVG/CSS charts. Every value is passed in already summed in integer cents; nothing is computed here
// beyond proportions for drawing.
import { formatUsd } from "@/lib/money";

export const STATUS_FILL: Record<string, string> = {
  PAID: "#059669", RELEASING: "#0ea5e9", PENDING_EVIDENCE: "#a1a1aa", IN_REVIEW: "#f59e0b", HELD: "#f43f5e", LOCKED: "#e4e4e7",
};
export const STATUS_LABEL: Record<string, string> = {
  PAID: "Paid", RELEASING: "Payment sent", PENDING_EVIDENCE: "Waiting for documents", IN_REVIEW: "Under review", HELD: "On hold", LOCKED: "Not open yet",
};

export type Bar = { verifiedCents: number; floatCents: number; unreleasedCents: number; totalCents: number };

/** Stacked bar: verified utilized (solid) | disbursed but unverified float (striped) | unreleased committed (neutral). */
export function DeploymentBar({ bar, committedCents, dense = false }: { bar: Bar; committedCents: number; dense?: boolean }) {
  const w = (c: number) => `${bar.totalCents > 0 ? (c * 100) / bar.totalCents : 0}%`;
  return (
    <div>
      <div className={`flex w-full overflow-hidden rounded-sm bg-zinc-200 ${dense ? "h-2" : "h-2.5"}`} role="img"
        aria-label={`Of ${formatUsd(committedCents)} committed: ${formatUsd(bar.verifiedCents)} proven with receipts, ${formatUsd(bar.floatCents)} paid with receipts still due, ${formatUsd(bar.unreleasedCents)} not paid yet`}>
        <div className="h-full bg-emerald-600" style={{ width: w(bar.verifiedCents) }} />
        <div className="h-full" style={{ width: w(bar.floatCents), backgroundImage: "repeating-linear-gradient(135deg, #6ee7b7 0 4px, #d1fae5 4px 8px)" }} />
      </div>
      <ul className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-zinc-600 ${dense ? "text-[10px]" : "text-[11px]"}`}>
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-600" />Receipts proven <span className="num text-zinc-900">{formatUsd(bar.verifiedCents)}</span></li>
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundImage: "repeating-linear-gradient(135deg, #6ee7b7 0 2px, #d1fae5 2px 4px)" }} />Paid, receipts still due <span className="num text-zinc-900">{formatUsd(bar.floatCents)}</span></li>
        <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-zinc-200" />Not paid yet <span className="num text-zinc-900">{formatUsd(bar.unreleasedCents)}</span></li>
      </ul>
    </div>
  );
}

/** Horizontal bars: awarded capital by sector. */
export function SectorBars({ sectors }: { sectors: { sector: string; awardedCents: number; ngoCount: number }[] }) {
  const max = Math.max(1, ...sectors.map((s) => s.awardedCents));
  const total = sectors.reduce((a, s) => a + s.awardedCents, 0);
  if (sectors.length === 0) return <p className="text-[12px] text-zinc-400">No grants for this funder yet.</p>;
  return (
    <ul className="space-y-3">
      {sectors.map((s) => (
        <li key={s.sector}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="font-medium text-zinc-800">{s.sector}</span>
            <span className="num text-zinc-600">{formatUsd(s.awardedCents)} <span className="text-zinc-400">· {total ? Math.round((s.awardedCents * 100) / total) : 0}%</span></span>
          </div>
          <div className="h-2 w-full rounded-sm bg-zinc-100"><div className="h-full rounded-sm bg-slate-800" style={{ width: `${(s.awardedCents * 100) / max}%` }} /></div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{s.ngoCount} {s.ngoCount === 1 ? "NGO" : "NGOs"}</div>
        </li>
      ))}
    </ul>
  );
}

const ORDER = ["PAID", "PENDING_EVIDENCE", "IN_REVIEW", "HELD", "RELEASING", "LOCKED"] as const;

/** Donut of tranche counts by status, with the four headline statuses as pills (dispatched and locked shown muted). */
export function TrancheDonut({ counts }: { counts: Record<string, number> }) {
  const total = ORDER.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = ORDER.filter((k) => (counts[k] ?? 0) > 0).map((k) => {
    const len = ((counts[k] ?? 0) / total) * C;
    const arc = { k, len, offset };
    offset += len;
    return arc;
  });
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 flex-none -rotate-90" role="img" aria-label={`${total} tranches by status`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f4f4f5" strokeWidth="14" />
        {arcs.map((a) => (
          <circle key={a.k} cx="50" cy="50" r={R} fill="none" stroke={STATUS_FILL[a.k]} strokeWidth="14" strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset} />
        ))}
        <g className="rotate-90" style={{ transformOrigin: "50px 50px" }}>
          <text x="50" y="49" textAnchor="middle" className="fill-zinc-900 font-mono" fontSize="18" fontWeight="600">{total}</text>
          <text x="50" y="61" textAnchor="middle" className="fill-zinc-400 font-mono" fontSize="7">TRANCHES</text>
        </g>
      </svg>
      <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        {ORDER.map((k) => (
          <li key={k} className={`flex items-center justify-between gap-2 ${["RELEASING", "LOCKED"].includes(k) ? "text-zinc-400" : "text-zinc-700"}`}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: STATUS_FILL[k] }} />{STATUS_LABEL[k]}</span>
            <span className="num text-zinc-900">{counts[k] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One square per tranche, coloured by status: a compact progress strip. */
export function TrancheStrip({ tranches }: { tranches: { seq: number; status: string }[] }) {
  return (
    <div className="flex gap-1" role="img" aria-label={tranches.map((t) => `Tranche ${t.seq} ${STATUS_LABEL[t.status] ?? t.status}`).join(", ")}>
      {tranches.map((t, i) => <span key={i} className="h-2 flex-1 rounded-sm" style={{ background: STATUS_FILL[t.status] ?? "#e4e4e7" }} title={`Tranche ${t.seq}: ${STATUS_LABEL[t.status] ?? t.status}`} />)}
    </div>
  );
}
