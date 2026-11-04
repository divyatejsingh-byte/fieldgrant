"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFunder, useNgo } from "./AppState";
import { Logo } from "./Logo";
import { HealthBadge } from "./HealthBadge";
import { useRole, type Role } from "./role";

const LINKS: Record<Role, [string, string][]> = {
  foundation: [["/portfolio", "Dashboard"], ["/review", "Review queue"], ["/reports", "Reports"], ["/ledger", "History"]],
  ngo: [["/partner", "Home"], ["/partner/submit", "Send documents"], ["/partner/reports", "Reports"], ["/partner/tranches", "My payments"]],
};

/** Persistent view switcher + section nav. Switching is client-side navigation: no reload, no data reset. */
export function Header() {
  const role = useRole();
  const path = usePathname();
  const { funder } = useFunder();
  const { ngo } = useNgo();
  const active = (href: string) => (href === "/partner" || href === "/portfolio" ? path === href : path.startsWith(href));

  const SWITCH = [
    { role: "foundation" as const, long: "Grantmaker Portal", short: "Grantmaker", who: funder?.name, href: "/portfolio" },
    { role: "ngo" as const, long: "Grantee Portal", short: "Grantee", who: ngo?.name, href: "/partner" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 py-3 text-[14px] font-semibold tracking-tight" aria-label="FieldGrant home">
          <Logo size={24} />
          <span className="hidden sm:inline">FieldGrant</span>
        </Link>

        <div className="my-2 flex items-center gap-2">
          <span className="hidden font-mono text-[10px] font-medium uppercase tracking-wide text-zinc-500 lg:inline">View</span>
          <div role="group" aria-label="View mode" className="flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 text-[12px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            {SWITCH.map((s) => (
              <Link
                key={s.role}
                href={s.href}
                aria-current={role === s.role ? "true" : undefined}
                className={`whitespace-nowrap rounded px-2.5 py-1 transition-colors ${role === s.role ? "bg-white text-zinc-900 shadow-[0_0_0_1px_#e4e4e7]" : "text-zinc-500 hover:text-zinc-900"}`}
              >
                <span className="md:hidden">{s.short}</span>
                <span className="hidden md:inline">{s.long}</span>
                {s.who && <span className="ml-1.5 hidden max-w-[150px] truncate align-bottom font-mono text-[10px] font-normal text-zinc-400 xl:inline-block">{s.who}</span>}
              </Link>
            ))}
          </div>
        </div>

        <nav className="-mb-px order-last flex w-full gap-1 overflow-x-auto [scrollbar-width:none] sm:order-none sm:w-auto [&::-webkit-scrollbar]:hidden" aria-label="Primary">
          {LINKS[role].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-medium transition-colors ${active(href) ? "border-slate-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <HealthBadge className="ml-auto hidden lg:inline-flex" />
        <span className="ml-auto hidden items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-600 sm:flex lg:ml-0">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          SANDBOX <span className="text-zinc-300">·</span> USD
        </span>
      </div>
    </header>
  );
}
