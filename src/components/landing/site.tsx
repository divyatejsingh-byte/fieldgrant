"use client";
import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../Logo";
import { HealthBadge } from "../HealthBadge";
import { useApi } from "../ui";

/** Public pages that bring their own header and footer instead of the app chrome (see AppShell). */
export const SITE_PATHS = ["/", "/vision", "/how-it-works", "/rules", "/history"];

/** Remember which view the visitor chose (presentation only; the header switcher reads the URL). */
export const chooseRole = (role: "foundation" | "ngo") => () => { try { localStorage.setItem("fg.role", role); } catch { /* storage unavailable */ } };

export const btnMain = "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800";
export const btnSoft = "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-5 text-[14px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50";

export function SectionHead({ tag, title, sub, tone = "text-emerald-600" }: { tag: string; title: string; sub?: string; tone?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <div className={`font-mono text-[11px] font-medium uppercase tracking-[0.12em] ${tone}`}>{tag}</div>
      <h2 className="mt-1.5 text-[28px] font-bold leading-9 tracking-tight text-slate-900 sm:text-[34px] sm:leading-10">{title}</h2>
      {sub && <p className="mt-2 text-[15px] leading-6 text-slate-600">{sub}</p>}
    </div>
  );
}

const LINKS = [["Architecture", "/how-it-works"], ["Verification Rules", "/rules"], ["Audit Ledger", "/history"], ["Vision", "/vision"]] as const;

/** Live: is the PayPal sandbox configured on this server? Never claims more than /api/status reports. */
function SandboxPill() {
  const { data } = useApi<{ paypalSandbox: boolean }>("/api/status");
  const on = !!data?.paypalSandbox;
  return (
    <span className="hidden items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-600 sm:inline-flex" title={on ? "PayPal sandbox credentials are configured on this server" : "PayPal sandbox credentials are not set on this server"}>
      <span className={`h-1.5 w-1.5 rounded-full ${data ? (on ? "bg-emerald-500" : "bg-amber-500") : "bg-zinc-300"}`} aria-hidden />
      {data ? (on ? "PayPal sandbox live" : "PayPal sandbox: no credentials") : "Checking PayPal"}
    </span>
  );
}

export function Nav({ githubUrl, current, minimal = false }: { githubUrl: string | null; current?: string; minimal?: boolean }) {
  const links = [...LINKS, ...(githubUrl ? [["Docs", `${githubUrl}#readme`] as const] : [])];
  const cls = (href: string) => `rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors ${current === href ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`;
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 py-3" aria-label="FieldGrant home">
          <Logo size={24} />
          <span className="text-[14px] font-bold uppercase tracking-[0.08em] text-slate-900">FieldGrant</span>
        </Link>
        <span className="hidden items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700 lg:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />Institutional sandbox</span>
        <nav className={`mx-auto hidden gap-0.5 ${minimal ? "" : "md:flex"}`} aria-label="Sections">
          {links.map(([label, href]) => <Link key={label} href={href} className={cls(href)}>{label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <SandboxPill />
          <HealthBadge compact className="hidden sm:inline-flex" />
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="btn-secondary" aria-label="GitHub repository"><ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">GitHub</span></a>
          )}
        </div>
      </div>
      <nav className={`flex gap-1 overflow-x-auto border-t border-zinc-100 px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden ${minimal ? "hidden" : ""}`} aria-label="Sections (mobile)">
        {links.map(([label, href]) => <Link key={label} href={href} className={`whitespace-nowrap px-2 py-2 text-[13px] font-medium ${current === href ? "text-slate-900" : "text-zinc-500"}`}>{label}</Link>)}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/portfolio" onClick={chooseRole("foundation")} className={btnMain}><ShieldCheck className="h-4 w-4" /> Open the demo</Link>
          <p className="text-[13px] text-slate-400">MIT licensed · Built for the Build What&apos;s Next with PayPal and AI hackathon</p>
        </div>
        <p className="mt-6 max-w-3xl text-[12px] leading-5 text-slate-400">
          A sandbox prototype of grant payment logic, in US dollars, for funders paying registered partner organizations. PayPal is used in its sandbox only.
          Nothing here is legal advice or a statement of compliance or readiness for real use; a real deployment needs review for each country&apos;s rules (for example FCRA in India).
        </p>
      </div>
    </footer>
  );
}

/** A page-sized hero strip for the sub pages. */
export function PageHero({ tag, title, sub, children }: { tag: string; title: ReactNode; sub: string; children?: ReactNode }) {
  return (
    <section className="border-b border-zinc-200 bg-zinc-50">
      <div className="relative mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-16">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-700">{tag}</div>
        <h1 className="mt-2 max-w-3xl text-[34px] font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-[46px]">{title}</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-600">{sub}</p>
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}

export const Arrow = () => <ArrowRight className="h-4 w-4" />;
