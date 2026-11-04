import type { ReactNode } from "react";
import { Footer, Nav } from "./site";

/** Server wrapper for the public pages: reads the optional GitHub link from the environment, then adds the shared header and footer. */
export function SitePage({ current, children }: { current?: string; children: ReactNode }) {
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || null;
  return (
    <div className="bg-slate-50 text-slate-900">
      <Nav githubUrl={githubUrl} current={current} />
      {children}
      <Footer />
    </div>
  );
}
