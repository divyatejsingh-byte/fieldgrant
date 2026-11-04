"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SITE_PATHS } from "./landing/site";
import { Header } from "./Header";
import { ResetButton } from "./ResetButton";

/** App chrome (header, container, footer) for every page except the landing page, which brings its own. */
export function AppShell({ children }: { children: ReactNode }) {
  if (SITE_PATHS.includes(usePathname())) return <>{children}</>;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 font-mono text-[11px] leading-4 text-zinc-500 sm:px-6">
        Sandbox prototype of tranche-release logic. The view switch changes what is shown; it is not access control. No claim of legal
        compliance or production readiness; real deployments need per-jurisdiction review (e.g. FCRA in India).{" "}
        <span className="text-zinc-300">·</span> <ResetButton />
      </footer>
    </>
  );
}
