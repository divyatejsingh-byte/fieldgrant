import { FileSearch } from "lucide-react";
import Link from "next/link";
import { SitePage } from "@/components/landing/SitePage";
import { Arrow, btnMain, btnSoft, PageHero } from "@/components/landing/site";
import { Badge } from "@/components/ui";

export const metadata = { title: "The rules | FieldGrant" };

const MUST = [
  "The receipt total fits the budget line (with a small allowance)",
  "The receipt is dated inside the grant period",
  "The same receipt file was never used before, by anyone",
  "The same vendor, date and amount wasn't already claimed",
  "This payment keeps total payouts within the grant's limit",
];
const LOOK = [
  "Enough people on the attendance list (photos alone are sent to a person)",
  "The line items add up to the total",
  "A second, independent reading finds the same total",
  "Prices match earlier receipts from the same vendor",
  "Quantities on the receipt agree with the headcount",
];

export default function Page() {
  return (
    <SitePage current="/rules">
      <PageHero tag="The rules" title="Ten checks, three possible answers"
        sub="Every submission goes through the same ten checks, in plain code. The answer is never a model's opinion.">
        <Link href="/partner" className={btnMain}>Try a submission <Arrow /></Link>
        <Link href="/how-it-works" className={btnSoft}>How it works</Link>
      </PageHero>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2"><span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[12px] font-semibold text-rose-700">Must pass</span><span className="text-[13px] text-slate-500">If any fails, payment is held</span></div>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-5 text-slate-700">{MUST.map((m) => <li key={m} className="flex gap-2"><FileSearch className="mt-0.5 h-4 w-4 flex-none text-rose-500" aria-hidden />{m}</li>)}</ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-800">Needs a second look</span><span className="text-[13px] text-slate-500">If any fails, a person reviews</span></div>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-5 text-slate-700">{LOOK.map((m) => <li key={m} className="flex gap-2"><FileSearch className="mt-0.5 h-4 w-4 flex-none text-amber-500" aria-hidden />{m}</li>)}</ul>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {([["RELEASE", "border-emerald-200", "Everything passes and the documents were read clearly. The payment is sent."], ["OFFICER_REVIEW", "border-amber-200", "Something looks unusual or unclear. A person decides, and the reason is recorded."], ["HOLD", "border-rose-200", "A must-pass check failed. The grantee is told exactly what to fix."]] as const).map(([b, c, d]) => (
              <div key={b} className={`rounded-2xl border ${c} bg-white p-5 shadow-sm`}>
                <Badge status={b} /><p className="mt-2 text-[14px] leading-5 text-slate-600">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-[14px] leading-6 text-slate-700">
            <b className="font-semibold">Before any of this:</b> if a grant requires registrations or audited accounts (for example FCRA in India) and one is missing or expired, the payment is held right away, before any document is even read.
          </p>
        </div>
      </section>
    </SitePage>
  );
}
