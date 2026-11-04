"use client";
import Link from "next/link";
import { SitePage } from "@/components/landing/SitePage";
import { Arrow, btnMain, btnSoft, chooseRole, PageHero } from "@/components/landing/site";
import { Badge, useApi } from "@/components/ui";

type LedgerRow = { id: number; created_at: string; ngo: string; event_type: string; status: string | null; payout_batch_id: string | null; is_seeded: number };
const plainEvent = (e: string) => { const s = e.replace(/_/g, " ").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };

export default function Page() {
  const { data } = useApi<LedgerRow[]>("/api/ledger");
  const rows = (data ?? []).slice(0, 15);
  return (
    <SitePage current="/history">
      <PageHero tag="History" title="A record nobody can quietly edit"
        sub="Every submission, decision, override and payment update is written to a history with who, when and why. If a person overrides the rules, their name, reason and the original decision are kept.">
        <Link href="/ledger" onClick={chooseRole("foundation")} className={btnMain}>Open the full history <Arrow /></Link>
        <Link href="/rules" className={btnSoft}>Read the rules</Link>
      </PageHero>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-4 py-2.5 text-[13px] font-semibold text-sky-800">Latest entries<span className="flex items-center gap-1.5 text-[12px] font-medium text-sky-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />Live</span></div>
            <ul className="divide-y divide-slate-100 text-[13px]">
              {rows.length === 0 && <li className="px-4 py-6 text-slate-400">Nothing yet. Send a document to create the first entry.</li>}
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="w-[132px] text-[12px] text-slate-500">{r.created_at}</span>
                  <span className="text-slate-800">{plainEvent(r.event_type)}</span>
                  <Badge status={r.status} />
                  {r.is_seeded ? <span className="text-[12px] text-slate-400">Example</span> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
