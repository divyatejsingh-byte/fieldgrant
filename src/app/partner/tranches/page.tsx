"use client";
import { NgoDetail } from "@/components/NgoDetail";
import { PageHeader, Skeleton } from "@/components/ui";
import { usePartner } from "../layout";
import { PaymentsGrid } from "../PaymentsGrid";

export default function MyTranches() {
  const { ngoId } = usePartner();
  return (
    <>
      <PageHeader title="My payments" sub="Your grants, the evidence each tranche needs, and where each one stands." />
      <PaymentsGrid />
      {ngoId ? <NgoDetail id={ngoId} partner /> : <Skeleton className="h-64 w-full" />}
    </>
  );
}
