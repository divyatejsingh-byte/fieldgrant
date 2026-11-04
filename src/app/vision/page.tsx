import { AlertTriangle, Clock, EyeOff, FileStack, HeartHandshake, Layers, Radar, Repeat, Zap } from "lucide-react";
import Link from "next/link";
import { SitePage } from "@/components/landing/SitePage";
import { Arrow, btnMain, btnSoft, PageHero, SectionHead } from "@/components/landing/site";

export const metadata = { title: "Our vision | FieldGrant" };

const PAIN = [
  { icon: FileStack, tone: "bg-rose-100 text-rose-700", title: "A mountain of paperwork", body: "Every payment needs receipts, attendance lists, registrations, audited accounts and funder-specific forms. Each funder wants them in its own format, on its own calendar." },
  { icon: Clock, tone: "bg-amber-100 text-amber-800", title: "Weeks of waiting", body: "A person has to open each file, read it, compare it with the budget and the grant terms, and write back. Meanwhile the next payment waits, and so does the work it was meant to fund." },
  { icon: EyeOff, tone: "bg-slate-100 text-slate-700", title: "Nobody sees the whole picture", body: "Funders can't easily tell what has been proven and what hasn't. Partners can't tell what is missing, or why a payment is stuck." },
  { icon: Layers, tone: "bg-sky-100 text-sky-700", title: "Many funders, many rules", body: "A partner funded by three foundations answers to three sets of rules, three fiscal years and three review queues, usually with the same small team." },
];

const HELPS = [
  { icon: Zap, tone: "bg-emerald-100 text-emerald-700", title: "Proof in, answer out", body: "A partner sends a receipt and proof of the work, in whatever form suits them. Within about 20 seconds they get a clear answer: paid, on hold with exactly what to fix, or sent to a person." },
  { icon: Radar, tone: "bg-emerald-100 text-emerald-700", title: "People only see the exceptions", body: "The routine cases are checked automatically against the same rules every time. Funder staff spend their time on the few cases that genuinely need judgment." },
  { icon: Repeat, tone: "bg-emerald-100 text-emerald-700", title: "One place for every document", body: "Registrations and audited accounts live in each partner's document vault, linked to every grant that requires them. Renew once, and every funder sees it." },
  { icon: HeartHandshake, tone: "bg-slate-100 text-slate-700", title: "A record both sides trust", body: "Every decision, override and payment update is written to a history with who, when and why. Funders get an audit trail. Partners get a clear reason for every outcome." },
];

export default function Page() {
  return (
    <SitePage current="/vision">
      <PageHero tag="Our vision" title={<>Less time proving the work. <span className="text-emerald-700">More time doing it.</span></>}
        sub="Good grants shouldn't stall on paperwork. We want funders and the organizations they fund to spend their energy on the people they serve.">
        <Link href="/partner" className={btnMain}>See it from the grantee side <Arrow /></Link>
        <Link href="/portfolio" className={btnSoft}>See it from the funder side</Link>
      </PageHero>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <SectionHead tag="The problem" title="Keeping track of payment compliance is slow and exhausting" sub="Funders have to be sure money was spent as agreed. Funded partners have to prove it. Both sides do real, necessary work, but the way it is done today holds good projects back." tone="text-rose-600" />
          <div className="grid gap-4 md:grid-cols-2">
            {PAIN.map((p) => (
              <article key={p.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${p.tone}`}><p.icon className="h-5 w-5" /></span>
                <div><h3 className="text-[17px] font-bold tracking-tight text-slate-900">{p.title}</h3><p className="mt-1.5 text-[14px] leading-6 text-slate-600">{p.body}</p></div>
              </article>
            ))}
          </div>
          <div className="mt-6 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-700" aria-hidden />
            <div>
              <h3 className="text-[17px] font-bold tracking-tight text-slate-900">The cost is paid by the people the grant was meant to help</h3>
              <p className="mt-1.5 text-[14px] leading-6 text-slate-700">When a payment is late, the clinic delays its next outreach, the water project waits for materials, and a small team spends its week chasing documents instead of serving communities. Small organizations feel it most, because they have the least spare staff and cash. Progress on social good slows, not because anyone is acting in bad faith, but because proof and payment don&apos;t move at the speed of the work.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <SectionHead tag="How FieldGrant helps" title="Make proof quick, clear and fair for both sides" sub="FieldGrant turns the slow back-and-forth into one simple flow, while keeping people in charge of the decisions that need judgment." tone="text-emerald-600" />
          <div className="grid gap-4 md:grid-cols-2">
            {HELPS.map((h) => (
              <article key={h.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${h.tone}`}><h.icon className="h-5 w-5" /></span>
                <div><h3 className="text-[17px] font-bold tracking-tight text-slate-900">{h.title}</h3><p className="mt-1.5 text-[14px] leading-6 text-slate-600">{h.body}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <SectionHead tag="Our principle" title="AI helps read. People and plain rules decide." sub="Trust matters more than speed. The AI only turns documents into data. It never decides, and it cannot be talked into approving a payment. Plain, repeatable rules make every decision, and a person can always step in, with their reason on record." tone="text-slate-600" />
          <div className="flex flex-wrap gap-3">
            <Link href="/how-it-works" className={btnMain}>See how it works <Arrow /></Link>
            <Link href="/rules" className={btnSoft}>Read the rules</Link>
          </div>
          <p className="mt-8 max-w-3xl text-[13px] leading-5 text-slate-500">FieldGrant is a hackathon prototype that runs entirely in the PayPal sandbox with mock documents. It shows a direction, not a finished product, and real use would need review for each country&apos;s legal requirements.</p>
        </div>
      </section>
    </SitePage>
  );
}
