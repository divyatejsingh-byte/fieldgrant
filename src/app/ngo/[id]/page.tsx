"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { useFunder } from "@/components/AppState";
import { NgoDetail, type NgoDetailData } from "@/components/NgoDetail";
import { PageHeader } from "@/components/ui";

/** Grantmaker view of one partner NGO. */
export default function NgoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { funder, funderId } = useFunder();
  const [meta, setMeta] = useState<NgoDetailData["ngo"] | null>(null);
  return (
    <>
      <Link href="/portfolio" className="mb-3 inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-3 w-3" /> Portfolio</Link>
      <PageHeader title={meta?.name ?? "Partner NGO"} sub={meta ? `${meta.sector} · ${meta.country_label}${funder ? ` · grants from ${funder.name}` : ""}` : undefined} />
      <NgoDetail id={id} foundationId={funderId || undefined} onData={(d) => { if (!meta || meta.id !== d.ngo.id) setMeta(d.ngo); }} />
    </>
  );
}
