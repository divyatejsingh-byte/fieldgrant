"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type Role = "foundation" | "ngo";

const FOUNDATION_PATHS = (p: string) => p.startsWith("/portfolio") || p.startsWith("/review") || p.startsWith("/ledger") || p.startsWith("/reports") || p.startsWith("/ngo/");

/**
 * Which persona is looking at the screen. This is presentation only (no auth, by design):
 * the URL decides where it is unambiguous, and shared pages (decision detail) fall back to the last role used.
 */
export function useRole(): Role {
  const path = usePathname();
  const [stored, setStored] = useState<Role>("foundation");
  const derived: Role | null = path.startsWith("/partner") ? "ngo" : FOUNDATION_PATHS(path) ? "foundation" : null;

  useEffect(() => {
    try {
      const s = localStorage.getItem("fg.role");
      if (s === "ngo" || s === "foundation") setStored(s);
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    if (!derived) return;
    setStored(derived);
    try { localStorage.setItem("fg.role", derived); } catch { /* storage unavailable */ }
  }, [derived]);

  return derived ?? stored;
}
