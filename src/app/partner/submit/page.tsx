"use client";
import { Loader2, ScanSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { usePartnerDraft, type DraftTranche } from "@/components/AppState";
import { Dropzone } from "@/components/Dropzone";
import { GateCard } from "@/components/GateCard";
import { EvidencePicker } from "@/components/EvidencePicker";
import { Inspection } from "@/components/Inspection";
import { LedgerGrid } from "@/components/LedgerGrid";
import type { SubmissionDetail } from "@/components/types";
import { ErrorBox, Money, PageHeader, Panel, Skeleton, emitDataChanged, useApi } from "@/components/ui";
import { usePartner } from "../layout";
import { ScenarioBar, type ScenarioRun } from "../ScenarioBar";

function Workspace() {
  const qs = useSearchParams();
  const { ngoId } = usePartner();
  // Form state lives in a root-level draft so flipping to the Grantmaker view and back keeps files, memo and result.
  const { draft, patch } = usePartnerDraft();
  const { trancheId, receipt, evidence, memo, submissionId } = draft;
  const detail = useApi<{ submittable: DraftTranche[] }>(ngoId ? `/api/ngos/${ngoId}` : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const result = useApi<SubmissionDetail>(submissionId ? `/api/submissions/${submissionId}` : null);

  // Only a real change of organisation clears the draft (not merely re-entering this page).
  useEffect(() => {
    if (!ngoId) return;
    if (draft.ngoId && draft.ngoId !== ngoId) patch({ ngoId, trancheId: "", receipt: null, evidence: [], memo: "", submissionId: null, snap: null });
    else if (!draft.ngoId) patch({ ngoId });
  }, [ngoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A deep link (?tranche=) selects that tranche once.
  useEffect(() => { const t = qs.get("tranche"); if (t) patch({ trancheId: t }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tranches = detail.data?.submittable ?? [];
  useEffect(() => {
    if (detail.data && !tranches.some((t) => String(t.id) === trancheId) && !(submissionId && draft.snap && String(draft.snap.id) === trancheId)) patch({ trancheId: tranches[0] ? String(tranches[0].id) : "" });
  }, [detail.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = tranches.find((t) => String(t.id) === trancheId) ?? null;
  const reload = useCallback(() => { void result.reload(); void detail.reload(); }, [result.reload, detail.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs the live pipeline for one set of documents (from the form or from a one-click scenario). */
  async function submit(p: ScenarioRun) {
    setErr(null); setBusy(true);
    patch({ submissionId: null, snap: p.snap }); // the tranche leaves the "waiting" list once decided; keep its numbers for the result
    const fd = new FormData();
    fd.set("ngo_id", p.ngoId);
    fd.set("tranche_id", p.trancheId);
    fd.set("receipt", p.receipt);
    for (const f of p.evidence) fd.append("evidence", f);
    fd.set("memo", p.memo);
    try {
      const r = await fetch("/api/submissions", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong while checking your documents.");
      patch({ ngoId: p.ngoId, trancheId: p.trancheId, submissionId: j.submissionId, snap: p.snap, receipt: null, evidence: [], memo: "" });
      void detail.reload();
      emitDataChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const run = () => { if (receipt && selected) return submit({ ngoId, trancheId, snap: selected, receipt, evidence, memo }); };

  const needProof = (selected?.requirements.required_attendees ?? 0) > 0;
  const ready = !!receipt && (!needProof || evidence.length > 0) && !!selected && !busy;
  const d = result.data;
  const maxCents = selected ? Math.floor((selected.requirements.budget_line_cents * (100 + selected.requirements.tolerance_pct)) / 100) : 0;

  return (
    <>
      <PageHeader title="Send documents" sub="Three steps: choose the payment, add your receipt and proof of work, then get an answer in about 20 seconds." />
      <ScenarioBar busy={busy} onRun={submit} />
      {selected && <div className="mb-4"><GateCard grantId={selected.grant_id} /></div>}

      <div className="mb-8 grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4">
          <Panel title="Step 1 · Choose the payment">
            <label className="sr-only" htmlFor="tr">Payment</label>
            <select id="tr" className="field h-9 text-[14px]" value={trancheId} onChange={(e) => patch({ trancheId: e.target.value, submissionId: null })} disabled={tranches.length === 0}>
              {tranches.length === 0 && <option>{detail.loading ? "Loading" : "Nothing is waiting for documents right now"}</option>}
              {tranches.map((t) => <option key={t.id} value={t.id}>{t.funder_name} · {t.grant_name} · Tranche {t.seq}{t.status === "HELD" ? " (send again)" : ""}</option>)}
            </select>
            <div className="mt-3 min-h-10 rounded-md bg-zinc-50 px-3 py-2.5 text-[13px] leading-5 text-zinc-700">
              {selected ? (
                <>This payment is <Money cents={selected.amount_cents} />. <b className="font-medium">What to send:</b> a receipt for {selected.requirements.budget_line_label.toLowerCase()} (up to <Money cents={maxCents} />)
                  {selected.requirements.required_attendees > 0 && <> and proof the work happened, such as an attendance list, project photos or a report. A list of at least <span className="num">{selected.requirements.required_attendees}</span> people can be approved automatically; photos alone go to a person to review</>}.</>
              ) : <span className="text-zinc-500">No payment is waiting for documents. You&apos;re up to date.</span>}
            </div>
          </Panel>

          <Panel title="Step 2 · Add your documents">
            <div className="space-y-3">
              <Dropzone label="Receipt" hint="PDF, PNG or JPG, up to 8 MB" file={receipt} onFile={(f) => patch({ receipt: f })} required />
              <EvidencePicker files={evidence} onChange={(f) => patch({ evidence: f })} required={needProof} />
              <div>
                <label className="label mb-1 block" htmlFor="memo">Note <span className="font-normal text-zinc-400">(optional)</span></label>
                <textarea id="memo" rows={2} maxLength={4000} value={memo} onChange={(e) => patch({ memo: e.target.value })} placeholder="What was delivered, and to how many people" className="field h-auto resize-none py-1.5 text-[14px]" />
              </div>
              {err && <ErrorBox message={err} />}
              <button className="btn-primary h-10 w-full text-[14px]" disabled={!ready} onClick={run}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading your documents (about 20 seconds)</> : <><ScanSearch className="h-4 w-4" /> Check my documents</>}
              </button>
              {!ready && !busy && <p className="text-center text-[12px] text-zinc-500">{!selected ? "Choose a payment in step 1." : !receipt ? "Add your receipt to continue." : needProof && evidence.length === 0 ? "Add at least one proof of work to continue." : ""}</p>}
            </div>
          </Panel>

          <h3 className="px-1 pt-1 text-[13px] font-medium text-zinc-600">Step 3 · The decision appears here</h3>
          {submissionId && (result.loading || !d) && <Skeleton className="h-64 w-full" />}
          {submissionId && d && <Inspection d={d} onChange={reload} role="ngo" />}
          {!submissionId && !busy && <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-[13px] text-zinc-500">Your decision and next steps will show up here.</div>}
        </div>

        <div className="lg:sticky lg:top-[68px]">
          {ngoId ? <LedgerGrid key={ngoId} ngoId={ngoId} compact ngoFilter={false} title="Your history" height="min(640px, calc(100vh - 360px))" /> : <Skeleton className="h-96 w-full" />}
        </div>
      </div>

    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Skeleton className="h-96 w-full" />}><Workspace /></Suspense>;
}
