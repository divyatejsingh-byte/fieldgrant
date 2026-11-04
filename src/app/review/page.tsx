"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFunder } from "@/components/AppState";
import { ReviewQueueGrid, type ReviewItem } from "@/components/ReviewQueueGrid";
import { Badge, ErrorBox, Money, PageHeader, Panel, Skeleton, emitDataChanged, postJson, useApi } from "@/components/ui";

type Item = ReviewItem;

export default function ReviewPage() {
  const { funder, funderId } = useFunder();
  const { data, error, loading, reload } = useApi<Item[]>(funderId ? `/api/review?foundation_id=${funderId}` : null, 10000);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Keep a valid selection: the first waiting item, or the same one after a refresh; none when the queue empties.
  useEffect(() => {
    if (!data) return;
    if (!data.some((i) => i.id === selectedId)) setSelectedId(data[0]?.id ?? null);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = data?.find((i) => i.id === selectedId) ?? null;

  return (
    <>
      <PageHeader title="Review queue" sub={`Submissions the rules couldn't settle on their own${funder ? ` for ${funder.name}` : ""}. Pick one, read why, then approve or keep it on hold. Your reason is recorded.`} />
      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton className="h-40 w-full" />}
      {data?.length === 0 && <Panel><p className="text-[14px] text-zinc-600">Nothing is waiting for your decision. Anything unusual that comes in will appear here.</p></Panel>}
      {data && data.length > 0 && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <ReviewQueueGrid items={data} selectedId={selectedId} onSelect={setSelectedId} />
          {selected && <Decision key={selected.id} item={selected} onDone={reload} />}
        </div>
      )}
    </>
  );
}

function Decision({ item: i, onDone }: { item: Item; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function act(newDecision: "RELEASE" | "HOLD") {
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await postJson<{ payoutError?: string }>("/api/review/override", { submissionId: i.id, newDecision, reason });
      emitDataChanged(); // the decision itself changed verified-utilized capital, even if the payout could not start
      if (r.payoutError) { setNote(`Decision recorded, but the payout did not start: ${r.payoutError}`); setBusy(false); return; }
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[16px] font-semibold">{i.ngo_name}</span>
        <Badge status={i.decision} />
        <Link href={`/submissions/${i.id}`} className="ml-auto text-[13px] font-medium text-emerald-700 underline underline-offset-2">See the full evidence</Link>
      </div>
      <div className="mt-1 text-[13px] text-zinc-600">{i.grant_name} · <span className="num">Tranche {i.seq}</span> · <Money cents={i.amount_cents} /></div>
      {i.llm_explanation && <p className="mt-3 text-[14px] leading-6 text-zinc-800">{i.llm_explanation}</p>}
      <ul className="mt-2 space-y-0.5 text-[13px] text-zinc-500">{i.decision_reason.split("\n").slice(0, 3).map((r, k) => <li key={k}>· {r}</li>)}</ul>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
        <input className="field h-9 min-w-56 flex-1 text-[14px]" placeholder="Your reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        <button className="btn-clear h-9" disabled={busy || reason.trim().length < 5} onClick={() => act("RELEASE")}>{i.decision === "HOLD" ? "Override and approve" : "Approve and pay"}</button>
        <button className="btn-danger h-9" disabled={busy || reason.trim().length < 5 || i.tranche_status === "HELD"} onClick={() => act("HOLD")}>Keep on hold</button>
      </div>
      {err && <div className="mt-2"><ErrorBox message={err} /></div>}
      {note && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{note}</div>}
    </Panel>
  );
}
