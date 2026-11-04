"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FoundationSummary } from "@/lib/foundations";
import { DATA_CHANGED, useApi } from "./ui";

export type DraftTranche = {
  id: number; grant_id: number; seq: number; amount_cents: number; status: string; grant_name: string; funder_name: string; cap_cents: number; committed_cents: number;
  requirements: { required_attendees: number; budget_line_label: string; budget_line_cents: number; tolerance_pct: number };
};

/** The NGO's in-progress submission. Lives above the route tree so switching Grantmaker <-> Grantee never loses it. */
export type PartnerDraft = {
  ngoId: string;
  trancheId: string;
  receipt: File | null;
  evidence: File[];
  memo: string;
  submissionId: number | null;
  snap: DraftTranche | null;
};

const EMPTY: PartnerDraft = { ngoId: "", trancheId: "", receipt: null, evidence: [], memo: "", submissionId: null, snap: null };

export type NgoLite = { id: number; name: string; sector: string; country_code: string };

type Ctx = {
  draft: PartnerDraft;
  patch: (p: Partial<PartnerDraft>) => void;
  foundations: FoundationSummary[];
  funderId: string;
  setFunderId: (v: string) => void;
  ngos: NgoLite[];
  ngoId: string;
  setNgoId: (v: string) => void;
  reloadFoundations: () => void;
};

const AppCtx = createContext<Ctx>({
  draft: EMPTY, patch: () => {}, foundations: [], funderId: "", setFunderId: () => {}, ngos: [], ngoId: "", setNgoId: () => {}, reloadFoundations: () => {},
});

const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

/**
 * App-wide identity (demo personas, not auth): which funder the grantmaker view is scoped to, which NGO the grantee view
 * is, plus the grantee's draft form. Lives above the route tree so view switches are instant and lose nothing.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<PartnerDraft>(EMPTY);
  const patch = useCallback((p: Partial<PartnerDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  const f = useApi<FoundationSummary[]>("/api/foundations");
  const n = useApi<NgoLite[]>("/api/ngos");
  const [funderId, setFunderIdState] = useState("");
  const [ngoId, setNgoIdState] = useState("");

  // Pick the stored selection if it still exists, otherwise the first (Global Horizon / CleanWater by seed order).
  useEffect(() => {
    if (!f.data?.length) return;
    const want = read("fg.funder");
    setFunderIdState((cur) => (f.data!.some((x) => String(x.id) === cur) ? cur : f.data!.some((x) => String(x.id) === want) ? want : String(f.data![0].id)));
  }, [f.data]);
  useEffect(() => {
    if (!n.data?.length) return;
    const want = read("fg.ngo");
    setNgoIdState((cur) => (n.data!.some((x) => String(x.id) === cur) ? cur : n.data!.some((x) => String(x.id) === want) ? want : String(n.data![0].id)));
  }, [n.data]);

  // A funder FY-model change (or reset) emits this event, so the header and selectors stay current.
  const reloadFoundations = f.reload;
  useEffect(() => {
    const h = () => { void f.reload(); void n.reload(); };
    window.addEventListener(DATA_CHANGED, h);
    return () => window.removeEventListener(DATA_CHANGED, h);
  }, [f.reload, n.reload]);

  const setFunderId = useCallback((v: string) => { setFunderIdState(v); write("fg.funder", v); }, []);
  const setNgoId = useCallback((v: string) => { setNgoIdState(v); write("fg.ngo", v); }, []);

  const value = useMemo<Ctx>(
    () => ({ draft, patch, foundations: f.data ?? [], funderId, setFunderId, ngos: n.data ?? [], ngoId, setNgoId, reloadFoundations }),
    [draft, patch, f.data, funderId, setFunderId, n.data, ngoId, setNgoId, reloadFoundations],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const usePartnerDraft = () => {
  const { draft, patch } = useContext(AppCtx);
  return { draft, patch };
};

/** Active funder for the grantmaker view. */
export function useFunder() {
  const { foundations, funderId, setFunderId, reloadFoundations } = useContext(AppCtx);
  const funder = foundations.find((x) => String(x.id) === funderId) ?? null;
  return { foundations, funder, funderId, setFunderId, reloadFoundations };
}

/** Active NGO for the grantee view. */
export function useNgo() {
  const { ngos, ngoId, setNgoId } = useContext(AppCtx);
  return { ngos, ngo: ngos.find((x) => String(x.id) === ngoId) ?? null, ngoId, setNgoId };
}
