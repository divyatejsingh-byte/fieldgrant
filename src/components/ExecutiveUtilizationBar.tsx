"use client";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FY_MODELS, fyMonthsLabel, type FYModel } from "@/lib/fiscal-year";
import { formatUsd } from "@/lib/money";
import type { GrantmakerOverview } from "@/lib/overview";
import { useFunder } from "./AppState";
import { ErrorBox, Skeleton, emitDataChanged } from "./ui";

const micro = "font-mono text-[10px] uppercase tracking-wider text-zinc-500";
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part * 1000) / total) / 10}%` : "0%");

/** Fiscal-year model picker styled like an institutional currency selector: code on the left, months on the right. */
function FyModelSelect({ value, disabled, onPick }: { value: FYModel; disabled: boolean; onPick: (m: FYModel) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-2 rounded-md border border-zinc-300 bg-white pl-2.5 pr-2 font-mono text-[12px] text-zinc-900 transition-colors hover:border-zinc-400 disabled:opacity-50">
        <span className="text-zinc-500">FY</span><span className="font-medium">{value.replace("_", "/")}</span>
        <span className="text-zinc-400">{fyMonthsLabel(value)}</span><ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>
      {open && (
        <ul role="listbox" aria-label="Fiscal year model" className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {FY_MODELS.map((m) => (
            <li key={m} role="option" aria-selected={m === value}>
              <button type="button" onClick={() => { setOpen(false); if (m !== value) onPick(m); }}
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left font-mono text-[12px] hover:bg-zinc-50">
                <span className="flex items-center gap-2"><span className="w-3">{m === value && <Check className="h-3 w-3 text-emerald-600" />}</span>{m.replace("_", "/")}</span>
                <span className="text-zinc-500">{fyMonthsLabel(m)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Capital allocator: one bar for the funder's committed capital in its own fiscal year, split into proven | paid, receipts due |
 * not yet paid, with crisp dividers and a mono percentage for each segment. All values arrive as integer cents.
 */
export function ExecutiveUtilizationBar({ ov, year, setYear }: { ov: GrantmakerOverview | null; year: number | null; setYear: (y: number | null) => void }) {
  const { funder, reloadFoundations } = useFunder();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function changeModel(fyModel: FYModel) {
    if (!funder) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/foundations/${funder.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fyModel }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Could not save the fiscal-year model");
      setYear(null); reloadFoundations(); emitDataChanged();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  if (!ov) return <Skeleton className="mb-4 h-40 w-full" />;
  const u = ov.utilization;
  const { bar } = u;
  const w = (c: number) => `${bar.totalCents > 0 ? (c * 100) / bar.totalCents : 0}%`;
  const segs = [
    { label: "Proven by receipts", cents: bar.verifiedCents, swatch: "bg-emerald-600", fill: { backgroundColor: "#059669" } },
    { label: "Paid, receipts due", cents: bar.floatCents, swatch: "bg-emerald-300", fill: { backgroundImage: "repeating-linear-gradient(135deg, #6ee7b7 0 4px, #a7f3d0 4px 8px)" } },
    { label: "Not paid yet", cents: bar.unreleasedCents, swatch: "bg-zinc-300", fill: { backgroundColor: "#e4e4e7" } },
  ];

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Capital allocation">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 px-4 py-2.5">
        <div className={micro}>Capital allocation · {u.label}</div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Fiscal year" className="flex overflow-hidden rounded-md border border-zinc-300 font-mono text-[12px]">
            {ov.years.map((y) => (
              <button key={y.startYear} type="button" aria-pressed={y.startYear === u.startYear} onClick={() => setYear(y.startYear)}
                className={`border-r border-zinc-300 px-2.5 py-1 last:border-r-0 transition-colors ${y.startYear === u.startYear ? "bg-slate-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>{y.label}</button>
            ))}
          </div>
          <FyModelSelect value={u.model} disabled={saving || !funder} onPick={(m) => void changeModel(m)} />
        </div>
      </header>

      <div className="px-4 pb-4 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className={micro}>Committed capital</div>
            <div className="mt-1 font-mono text-[28px] font-semibold leading-8 tabular-nums tracking-tight text-zinc-900">{formatUsd(u.committedCents)}</div>
          </div>
          <div className="flex gap-1.5">
            <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700">PAID {pct(u.disbursedCents, u.committedCents)}</span>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">PROVEN {pct(u.utilizedCents, u.committedCents)}</span>
          </div>
        </div>

        <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-sm" role="img"
          aria-label={`Of ${formatUsd(u.committedCents)} committed: ${segs.map((s) => `${formatUsd(s.cents)} ${s.label.toLowerCase()}`).join(", ")}`}>
          {segs.map((s) => <div key={s.label} className="h-full" style={{ width: w(s.cents), ...s.fill }} />)}
        </div>

        <dl className="mt-3 grid grid-cols-3 divide-x divide-zinc-200/80 border-t border-zinc-200/80">
          {segs.map((s) => (
            <div key={s.label} className="min-w-0 px-3 pt-3 first:pl-0">
              <dt className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-[2px] ${s.swatch}`} /><span className={`${micro} truncate`}>{s.label}</span></dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[15px] font-medium tabular-nums text-zinc-900">{formatUsd(s.cents)}</span>
                <span className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-600">{pct(s.cents, bar.totalCents)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {err && <div className="border-t border-zinc-200 p-3"><ErrorBox message={err} /></div>}
    </section>
  );
}
