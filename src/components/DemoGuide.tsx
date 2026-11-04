"use client";
import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STEPS = [
  { n: 1, title: "Send documents as a grantee", body: "Open the Grantee view, choose a demo sample, and press Check my documents.", href: "/partner/submit", cta: "Open Grantee view", role: "ngo" as const },
  { n: 2, title: "Watch the decision", body: "In about 20 seconds you get a plain answer: approved and paid, on hold with what to fix, or sent to a person to review.", href: null, cta: "", role: "ngo" as const },
  { n: 3, title: "See it as the funder", body: "Switch to the Grantmaker view. The payout shows up in the figures and the history, and anything unusual waits in the review queue.", href: "/portfolio", cta: "Open Grantmaker view", role: "foundation" as const },
  { n: 4, title: "Try the tricky ones", body: "The samples include a receipt that's 30% over budget, a blurry one, one with a hidden instruction aimed at the AI, and a copy another NGO already used. None of them gets paid automatically.", href: null, cta: "", role: "ngo" as const },
];

const remember = (role: "foundation" | "ngo") => () => { try { localStorage.setItem("fg.role", role); } catch { /* storage unavailable */ } };

/** `section` is the big version for the landing page; `banner` is a dismissible strip inside the app. */
export function DemoGuide({ variant = "banner" }: { variant?: "banner" | "section" }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem("fg.guide") === "hidden"); } catch { setHidden(false); } }, []);

  const grid = (
    <ol className={`grid gap-3 ${variant === "section" ? "md:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {STEPS.map((s) => (
        <li key={s.n} className="flex flex-col rounded-md border border-zinc-200/80 bg-white p-4">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[12px] font-semibold text-white">{s.n}</span>
          <h3 className="mt-2 text-[14px] font-semibold leading-5">{s.title}</h3>
          <p className="mt-1 flex-1 text-[13px] leading-5 text-zinc-600">{s.body}</p>
          {s.href && <Link href={s.href} onClick={remember(s.role)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-slate-900 underline underline-offset-2">{s.cta} <ArrowRight className="h-3 w-3" /></Link>}
        </li>
      ))}
    </ol>
  );

  if (variant === "section") {
    return (
      <section id="try" className="scroll-mt-16 border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
          <h2 className="text-[28px] font-semibold leading-9 tracking-tight">Try it in two minutes</h2>
          <p className="mb-6 mt-2 max-w-2xl text-[15px] leading-6 text-zinc-600">No login and nothing to prepare. The demo comes with mock receipts and attendance lists, and uses the PayPal sandbox, so no real money moves.</p>
          {grid}
        </div>
      </section>
    );
  }

  if (hidden) return null;
  return (
    <section className="mb-5 rounded-lg border border-sky-200 bg-sky-50/60 p-4" aria-label="Demo guide">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">First time here? Try the demo in four steps</h2>
          <p className="text-[13px] text-zinc-600">Uses mock documents and the PayPal sandbox, so no real money moves.</p>
        </div>
        <button type="button" aria-label="Hide the guide" onClick={() => { setHidden(true); try { localStorage.setItem("fg.guide", "hidden"); } catch { /* storage unavailable */ } }} className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-800"><X className="h-4 w-4" /></button>
      </div>
      {grid}
    </section>
  );
}
