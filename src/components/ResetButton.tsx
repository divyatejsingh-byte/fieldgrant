"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePartnerDraft } from "./AppState";
import { emitDataChanged, postJson } from "./ui";

export function ResetButton({ to = "/portfolio" }: { to?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { patch } = usePartnerDraft();
  return (
    <button
      className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Reset all demo data (submissions, ledger, tranche states)?")) return;
        setBusy(true);
        try {
          await postJson("/api/demo/reset"); // re-runs the seed transaction in the running server: no restart needed
          patch({ trancheId: "", receipt: null, evidence: [], memo: "", submissionId: null, snap: null }); // drop any open decision or draft
          emitDataChanged(); // funders, grantees, ledger, charts and the payments table refetch
          router.push(to);
        } catch (e) { alert((e as Error).message); }
        setBusy(false);
      }}
    >
      {busy ? "Resetting..." : "Reset demo data"}
    </button>
  );
}
