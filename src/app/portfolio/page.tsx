"use client";
import { GrantmakerDashboard } from "@/components/GrantmakerDashboard";
import { PageHeader } from "@/components/ui";

/** Grantmaker home: the active funder's capital, tranche health, grantees and audit ledger. */
export default function Portfolio() {
  return (
    <>
      <PageHeader title="Grantmaker dashboard" sub="Capital committed, disbursed and verified for your funder, in your fiscal year. Evidence is verified against your policy automatically; only exceptions reach you." />
      <GrantmakerDashboard />
    </>
  );
}
