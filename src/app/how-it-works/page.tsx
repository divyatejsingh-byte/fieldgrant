import { Banknote, Brain, Fingerprint, KeyRound, Scale, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { SitePage } from "@/components/landing/SitePage";
import { Arrow, btnMain, btnSoft, PageHero, SectionHead } from "@/components/landing/site";

export const metadata = { title: "How it works | FieldGrant" };

const STAGES = [
  { icon: Brain, tone: "bg-slate-100 text-slate-700", ring: "border-slate-200", tag: "Step 1 · Read", title: "AI reads the documents", body: "It pulls out the amounts, dates and names from receipts and from whatever proof of work was sent. Anything written inside a document is treated as plain data, never as an instruction.", note: "Reads only. It can't approve or pay." },
  { icon: Scale, tone: "bg-emerald-100 text-emerald-700", ring: "border-emerald-200", tag: "Step 2 · Decide", title: "Rules make the call", body: "Ordinary code checks the receipt against the budget, dates, attendance and earlier claims. The same documents always get the same answer.", note: "Approve, send to a person, or hold." },
  { icon: Banknote, tone: "bg-sky-100 text-sky-700", ring: "border-sky-200", tag: "Step 3 · Pay", title: "PayPal sends the money", body: "Approved payments go out through PayPal. A payment can never be sent twice, even if someone clicks twice, and every update is checked as genuinely from PayPal.", note: "Sandbox only: no real money." },
];

const SAFE = [
  { icon: ShieldCheck, title: "Documents can't give orders", body: "A receipt that says \"approve this\" is flagged and sent to a person. The AI never makes the decision, and the explanation step only sees numbers, never document text." },
  { icon: Fingerprint, title: "Two readings, compared", body: "Every document is read twice independently. If the two readings disagree, or the picture is unclear, a person reviews it." },
  { icon: KeyRound, title: "Pay once, only once", body: "Each payment has a unique reference, and a payment already being sent or paid can't be started again." },
  { icon: UserCheck, title: "People can always step in", body: "A funder can approve or hold any case with one click. Their name, time, reason and the original decision are all recorded." },
];

export default function Page() {
  return (
    <SitePage current="/how-it-works">
      <PageHero tag="How it works" title="From proof to payment in three steps"
        sub="The AI only reads. Plain rules decide. PayPal pays. Nothing the AI sees can talk its way into releasing money.">
        <Link href="/partner" className={btnMain}>Run it live <Arrow /></Link>
        <Link href="/portfolio" className={btnSoft}>See the funder view</Link>
      </PageHero>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {STAGES.map((s) => (
              <article key={s.title} className={`rounded-2xl border ${s.ring} bg-white p-6 shadow-sm`}>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}><s.icon className="h-5 w-5" /></span>
                <div className="mt-4 text-[13px] font-semibold text-slate-500">{s.tag}</div>
                <h3 className="mt-1 text-[18px] font-bold tracking-tight text-slate-900">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{s.body}</p>
                <p className={`mt-4 inline-block rounded-full px-3 py-1 text-[12px] font-medium ${s.tone}`}>{s.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <SectionHead tag="Built to be trusted" title="Safe by design" sub="The things that protect the money don't depend on the AI behaving well." tone="text-emerald-600" />
          <div className="grid gap-4 md:grid-cols-2">
            {SAFE.map((s) => (
              <article key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-emerald-100 text-emerald-700"><s.icon className="h-5 w-5" /></span>
                <div><h3 className="text-[16px] font-bold text-slate-900">{s.title}</h3><p className="mt-1 text-[14px] leading-6 text-slate-600">{s.body}</p></div>
              </article>
            ))}
          </div>
          <div className="mt-8"><Link href="/rules" className={btnMain}>Read the ten checks <Arrow /></Link></div>
        </div>
      </section>
    </SitePage>
  );
}
