"use client";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { useNgo } from "@/components/AppState";
import type { GranteeOverview } from "@/lib/overview";
import { DATA_CHANGED, useApi } from "@/components/ui";

type Ctx = { ngoId: string; overview: GranteeOverview | null; reloadOverview: () => void };
const PartnerCtx = createContext<Ctx>({ ngoId: "", overview: null, reloadOverview: () => {} });
export const usePartner = () => useContext(PartnerCtx);

/** Grantee shell: NGO selector header (country, local FY, payout destination) and the shared overview data. */
export default function PartnerLayout({ children }: { children: ReactNode }) {
  const { ngos, ngoId, setNgoId } = useNgo();
  const { data, reload } = useApi<GranteeOverview>(ngoId ? `/api/grantee/overview?ngo_id=${ngoId}` : null, 5000);
  const reloadOverview = useCallback(() => void reload(), [reload]);

  // Deep link (?ngo=) selects that organisation once.
  useEffect(() => {
    const want = new URLSearchParams(location.search).get("ngo");
    if (want) setNgoId(want);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener(DATA_CHANGED, reloadOverview);
    return () => window.removeEventListener(DATA_CHANGED, reloadOverview);
  }, [reloadOverview]);

  const o = data && String(data.ngo.id) === ngoId ? data : null;
  return (
    <PartnerCtx.Provider value={{ ngoId, overview: o, reloadOverview }}>
      <div className="mb-5 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200/80 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <label htmlFor="partner-ngo" className="label">Active NGO</label>
          <select id="partner-ngo" className="field w-auto min-w-56" value={ngoId} onChange={(e) => setNgoId(e.target.value)}>
            {ngos.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
        {o ? (
          <>
            <span className="inline-flex h-6 items-center rounded border border-zinc-200 bg-zinc-50 px-2 font-mono text-[11px] font-medium text-zinc-700" title={o.ngo.country_label}>{o.ngo.country_code}</span>
            <span className="inline-flex h-6 items-center rounded border border-zinc-200 bg-zinc-50 px-2 font-mono text-[11px] text-zinc-700" title="Statutory fiscal year for this country">Local FY: {o.ngo.localFyMonths}</span>
            <span className="inline-flex min-w-0 items-center gap-2 text-[12px] text-zinc-600">
              <span className="label">PayPal payouts to</span>
              <span className="num truncate text-zinc-900">{o.ngo.paypal_email}</span>
            </span>
          </>
        ) : <span className="h-6 w-64 animate-pulse rounded bg-zinc-100" aria-hidden />}
        <span className="ml-auto text-[11px] text-zinc-400">Demo switcher, not a login</span>
      </div>
      {children}
    </PartnerCtx.Provider>
  );
}
