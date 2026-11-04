"use client";
import { useFunder } from "@/components/AppState";
import { LedgerGrid } from "@/components/LedgerGrid";
import { PageHeader } from "@/components/ui";

export default function LedgerPage() {
  const { funder, funderId } = useFunder();
  return (
    <>
      <PageHeader title="Ledger" sub={`Append-only audit trail of every submission, decision, override and payout event${funder ? ` for ${funder.name}` : ""}.`} />
      {funderId && <LedgerGrid key={funderId} foundationId={funderId} height="min(680px, calc(100vh - 330px))" />}
    </>
  );
}
