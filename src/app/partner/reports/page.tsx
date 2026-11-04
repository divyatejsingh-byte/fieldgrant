"use client";
import { CheckCircle2, FileUp, Loader2, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ReportsGrid } from "@/components/ReportsGrid";
import { ErrorBox, Hint, PageHeader, Panel, Skeleton, emitDataChanged, useApi } from "@/components/ui";
import { REPORT_META, REPORT_TYPES, type ReportRow, type ReportType } from "@/lib/reports";
import { usePartner } from "../layout";

const TYPE_LABEL: Record<ReportType, string> = { MONTHLY: "Monthly (optional)", QUARTERLY: "Quarterly", ANNUAL: "Annual" };

const now = new Date();
const YEAR = now.getFullYear();
const QUARTER = Math.floor(now.getMonth() / 3) + 1;
const MONTH = `${YEAR}-${String(now.getMonth() + 1).padStart(2, "0")}`;
/** The period each kind of report is due for right now. */
const CURRENT: Record<ReportType, string> = { MONTHLY: MONTH, QUARTERLY: `${YEAR}-Q${QUARTER}`, ANNUAL: String(YEAR) };

export default function ReportsPage() {
  const { ngoId, overview: o } = usePartner();
  const list = useApi<ReportRow[]>(ngoId ? `/api/reports?ngo_id=${ngoId}` : null);
  const grants = useMemo(() => (o?.funders ?? []).flatMap((f) => f.grants.map((g) => ({ id: g.id, name: g.name, funder: f.foundation.name }))), [o]);

  const [grantId, setGrantId] = useState("");
  const [type, setType] = useState<ReportType>("QUARTERLY");
  const [period, setPeriod] = useState(CURRENT.QUARTERLY);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const form = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const gid = grantId || String(grants[0]?.id ?? "");
  const rows = list.data ?? [];
  const sent = (g: string, t: ReportType, p: string) => rows.some((r) => String(r.grant_id) === g && r.period_type === t && r.period_label === p);

  function choose(g: string, t: ReportType) {
    setGrantId(g); setType(t); setPeriod(CURRENT[t]); setDone(null); setErr(null);
    form.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function useMock() {
    try {
      const r = await fetch("/api/samples/clean/roster.pdf");
      if (!r.ok) throw new Error("The mock report is not available on this server.");
      setFile(new File([await r.blob()], `mock-${type.toLowerCase()}-report.pdf`, { type: "application/pdf" }));
      setNote("Mock report for the demo.");
    } catch (e) { setErr((e as Error).message); }
  }

  async function submit() {
    if (!file || !gid) return;
    setBusy(true); setErr(null); setDone(null);
    const fd = new FormData();
    fd.set("ngo_id", ngoId); fd.set("grant_id", gid); fd.set("period_type", type); fd.set("period_label", period); fd.set("file", file); fd.set("note", note);
    try {
      const r = await fetch("/api/reports", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not share the report.");
      const g = grants.find((x) => String(x.id) === gid);
      setDone(`Shared with ${g?.funder ?? "your funder"}. They can open it from their Reports page.`);
      setFile(null); setNote("");
      if (input.current) input.current.value = "";
      void list.reload(); emitDataChanged();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const [pYear, pRest] = type === "ANNUAL" ? [period, ""] : type === "QUARTERLY" ? period.split("-") : [period.slice(0, 4), period.slice(5)];

  return (
    <>
      <PageHeader title="Reports" sub="Share progress reports with your funders. Quarterly and annual reports are expected; monthly reports are optional. Whatever you share here is visible to the funder of that grant." />

      {!o ? <Skeleton className="mb-6 h-40 w-full" /> : (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {grants.map((g) => (
            <section key={g.id} className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="text-[15px] font-semibold">{g.name}</div>
              <div className="text-[13px] text-zinc-500">Reports go to {g.funder}</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {REPORT_TYPES.map((t) => {
                  const ok = sent(String(g.id), t, CURRENT[t]);
                  return (
                    <button key={t} type="button" onClick={() => choose(String(g.id), t)}
                      className={`rounded-md border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${ok ? "border-emerald-200 bg-emerald-50" : t === "MONTHLY" ? "border-zinc-200/80 bg-white hover:border-zinc-300" : "border-amber-200 bg-amber-50 hover:border-amber-300"}`}>
                      <div className="text-[12px] font-medium text-zinc-700">{TYPE_LABEL[t]}</div>
                      <div className="num mt-0.5 text-[13px] font-semibold text-zinc-900">{CURRENT[t]}</div>
                      <div className={`mt-1 flex items-center gap-1 text-[12px] ${ok ? "text-emerald-700" : "text-zinc-600"}`}>
                        {ok ? <><CheckCircle2 className="h-3.5 w-3.5" /> Shared</> : t === "MONTHLY" ? "Optional" : "Due: send"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div ref={form} className="mb-6 scroll-mt-24">
        <Panel title="Share a report">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label mb-1 block" htmlFor="rg">Grant</label>
              <select id="rg" className="field h-9 text-[14px]" value={gid} onChange={(e) => setGrantId(e.target.value)}>
                {grants.map((g) => <option key={g.id} value={g.id}>{g.funder} · {g.name}</option>)}
              </select>
            </div>
            <div>
              <div className="label mb-1">How often<Hint text="Quarterly and annual reports are expected by most funders. Monthly reports are optional extras." /></div>
              <div role="tablist" aria-label="Report type" className="flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 text-[13px] font-medium">
                {REPORT_TYPES.map((t) => (
                  <button key={t} role="tab" aria-selected={type === t} type="button" onClick={() => { setType(t); setPeriod(CURRENT[t]); }}
                    className={`flex-1 rounded px-2 py-1.5 transition-colors ${type === t ? "bg-slate-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}>{TYPE_LABEL[t]}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="rp">Period covered</label>
              {type === "MONTHLY" && <input id="rp" type="month" className="field h-9 text-[14px]" value={period} onChange={(e) => setPeriod(e.target.value)} />}
              {type === "QUARTERLY" && (
                <div className="flex gap-2">
                  <select id="rp" className="field h-9 text-[14px]" value={pRest} onChange={(e) => setPeriod(`${pYear}-${e.target.value}`)} aria-label="Quarter">
                    {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q}>{q}</option>)}
                  </select>
                  <select className="field h-9 text-[14px]" value={pYear} onChange={(e) => setPeriod(`${e.target.value}-${pRest}`)} aria-label="Year">
                    {[YEAR - 2, YEAR - 1, YEAR, YEAR + 1].map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {type === "ANNUAL" && (
                <select id="rp" className="field h-9 text-[14px]" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {[YEAR - 2, YEAR - 1, YEAR, YEAR + 1].map((y) => <option key={y}>{y}</option>)}
                </select>
              )}
              <p className="mt-1 text-[12px] text-zinc-500">{REPORT_META[type].label} for <span className="num font-medium text-zinc-700">{period}</span></p>
            </div>
            <div>
              <label className="label mb-1 block" htmlFor="rf">Report file <span className="font-normal text-zinc-400">(PDF, PNG or JPG, up to 8 MB)</span></label>
              <div className="flex items-center gap-2">
                <input id="rf" ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg" className="field h-9 flex-1 py-1 text-[13px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" className="btn-secondary h-9" onClick={useMock}><FileUp className="h-3.5 w-3.5" /> Use a mock report</button>
              </div>
              {file && <p className="mt-1 truncate text-[12px] text-zinc-600">Ready: {file.name}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="label mb-1 block" htmlFor="rn">Note for the funder <span className="font-normal text-zinc-400">(optional)</span></label>
              <textarea id="rn" rows={2} maxLength={500} className="field h-auto resize-none py-1.5 text-[14px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the funder should know about this report" />
            </div>
          </div>
          {err && <div className="mt-3"><ErrorBox message={err} /></div>}
          {done && <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900"><CheckCircle2 className="h-4 w-4" />{done}</div>}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="btn-primary h-10 px-5 text-[14px]" disabled={!file || !gid || busy} onClick={submit}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sharing</> : <><Send className="h-4 w-4" /> Share with funder</>}
            </button>
            <span className="text-[12px] text-zinc-500">Reports are shared as documents. They don&apos;t affect payments.</span>
          </div>
        </Panel>
      </div>

      <h2 className="mb-2 text-[16px] font-semibold tracking-tight">Reports you&apos;ve shared</h2>
      {list.loading && !list.data ? <Skeleton className="h-40 w-full" /> : <ReportsGrid rows={rows} showFunder />}
    </>
  );
}
