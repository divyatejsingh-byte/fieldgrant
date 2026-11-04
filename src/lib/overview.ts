// Dashboard read models. Every figure is an integer-cents sum over real rows; nothing is estimated.
import type Database from "better-sqlite3";
import { loadUtilization, type UtilizationResponse } from "./analytics-data";
import { defaultLocalFY, fiscalYearRange, fyLabel, fyMonthsLabel, type FYModel } from "./fiscal-year";
import { getFoundation } from "./foundations";
import { covenantRows, getVault, grantCompliance, type CovenantRow } from "./compliance";
import { reviewQueue } from "./queries";
import type { GranteeDocumentRecord } from "@/types/grant";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const TRANCHE_STATUSES = ["PAID", "RELEASING", "PENDING_EVIDENCE", "IN_REVIEW", "HELD", "LOCKED"] as const;
export type TrancheCounts = Record<(typeof TRANCHE_STATUSES)[number], number>;

const emptyCounts = (): TrancheCounts => ({ PAID: 0, RELEASING: 0, PENDING_EVIDENCE: 0, IN_REVIEW: 0, HELD: 0, LOCKED: 0 });

export type CohortCard = {
  ngo: { id: number; name: string; sector: string; country_code: string; country_label: string };
  grants: { id: number; name: string; total_cents: number }[];
  awardedCents: number;
  paidCents: number;
  tranches: { id: number; seq: number; status: string; grantId: number }[];
  counts: TrancheCounts;
  /** First tranche that is waiting on evidence or a decision (the one the NGO is working on). */
  active: { id: number; seq: number; status: string; grantName: string } | null;
  latestSubmission: { id: number; decision: string | null } | null;
};

export type GrantmakerOverview = UtilizationResponse & {
  sectors: { sector: string; awardedCents: number; ngoCount: number }[];
  trancheHealth: TrancheCounts;
  cohort: CohortCard[];
  reviewCount: number;
};

export function loadGrantmakerOverview(db: Database.Database, foundationId: number, year?: number, today: Date = new Date()): GrantmakerOverview {
  const base = loadUtilization(db, { foundationId, year }, today);

  const tranches = db
    .prepare(
      `SELECT t.id, t.seq, t.status, t.amount_cents, g.id AS grant_id, g.name AS grant_name, g.ngo_id, g.total_cents
       FROM tranche t JOIN grant_award g ON g.id=t.grant_id WHERE g.foundation_id=? ORDER BY g.id, t.seq`,
    )
    .all(foundationId) as Row[];
  const grants = db.prepare("SELECT id, ngo_id, name, total_cents FROM grant_award WHERE foundation_id=? ORDER BY id").all(foundationId) as Row[];
  const ngos = db
    .prepare("SELECT DISTINCT n.id, n.name, n.sector, n.country_code, n.country_label FROM ngo n JOIN grant_award g ON g.ngo_id=n.id WHERE g.foundation_id=? ORDER BY n.id")
    .all(foundationId) as Row[];

  const trancheHealth = emptyCounts();
  for (const t of tranches) if (t.status in trancheHealth) trancheHealth[t.status as keyof TrancheCounts]++;

  const sectorMap = new Map<string, { awardedCents: number; ngos: Set<number> }>();
  for (const g of grants) {
    const n = ngos.find((x) => x.id === g.ngo_id);
    if (!n) continue;
    const s = sectorMap.get(n.sector) ?? { awardedCents: 0, ngos: new Set<number>() };
    s.awardedCents += g.total_cents;
    s.ngos.add(n.id);
    sectorMap.set(n.sector, s);
  }

  const cohort: CohortCard[] = ngos.map((n) => {
    const own = tranches.filter((t) => t.ngo_id === n.id);
    const counts = emptyCounts();
    for (const t of own) if (t.status in counts) counts[t.status as keyof TrancheCounts]++;
    const active = own.find((t) => ["PENDING_EVIDENCE", "IN_REVIEW", "HELD", "RELEASING"].includes(t.status));
    const sub = db
      .prepare(
        `SELECT s.id, s.decision FROM submission s JOIN tranche t ON t.id=s.tranche_id JOIN grant_award g ON g.id=t.grant_id
         WHERE g.foundation_id=? AND s.ngo_id=? ORDER BY s.id DESC LIMIT 1`,
      )
      .get(foundationId, n.id) as Row | undefined;
    return {
      ngo: { id: n.id, name: n.name, sector: n.sector, country_code: n.country_code, country_label: n.country_label },
      grants: grants.filter((g) => g.ngo_id === n.id).map((g) => ({ id: g.id, name: g.name, total_cents: g.total_cents })),
      awardedCents: grants.filter((g) => g.ngo_id === n.id).reduce((s, g) => s + g.total_cents, 0),
      paidCents: own.filter((t) => t.status === "PAID").reduce((s, t) => s + t.amount_cents, 0),
      tranches: own.map((t) => ({ id: t.id, seq: t.seq, status: t.status, grantId: t.grant_id })),
      counts,
      active: active ? { id: active.id, seq: active.seq, status: active.status, grantName: active.grant_name } : null,
      latestSubmission: sub ? { id: sub.id, decision: sub.decision } : null,
    };
  });

  return {
    ...base,
    sectors: [...sectorMap.entries()].map(([sector, v]) => ({ sector, awardedCents: v.awardedCents, ngoCount: v.ngos.size })).sort((a, b) => b.awardedCents - a.awardedCents),
    trancheHealth,
    cohort,
    reviewCount: reviewQueue(db, foundationId).length,
  };
}

export type FunderFacility = {
  foundation: { id: number; name: string; fyModel: FYModel };
  fyLabel: string;
  fyMonths: string;
  range: { start: string; end: string };
  utilization: UtilizationResponse["utilization"];
  grants: {
    id: number; name: string; total_cents: number;
    tranches: { id: number; seq: number; amount_cents: number; status: string }[];
    /** Gate 1: this grant's covenants against the NGO's vault. */
    compliance: { covenants: CovenantRow[]; passed: boolean; blockingOutstanding: number };
  }[];
  /** Tranches the NGO can submit evidence for right now. */
  actionable: { trancheId: number; grantId: number; grantName: string; seq: number; amount_cents: number; status: string }[];
};

export type GranteeOverview = {
  ngo: { id: number; name: string; sector: string; country_code: string; country_label: string; paypal_email: string; localFyModel: FYModel; localFyMonths: string };
  totals: { awardedCents: number; receivedCents: number; pendingLiquidityCents: number };
  funders: FunderFacility[];
  /** Every document the NGO holds, reusable across grants that require the same requirement. */
  vault: GranteeDocumentRecord[];
};

/**
 * Grantee dashboard. Each funder card is computed in THAT funder's own FY model (e.g. Global Horizon Jan-Dec vs
 * Wellspring Apr-Mar), never the grantee's local FY.
 * Pending milestone liquidity = tranches that can still be unlocked: awaiting evidence, in review, held, or dispatching.
 * Locked tranches are excluded because no evidence can reach them yet.
 */
export function loadGranteeOverview(db: Database.Database, ngoId: number, today: Date = new Date()): GranteeOverview | null {
  const n = db.prepare("SELECT id, name, sector, country_code, country_label, paypal_email FROM ngo WHERE id=?").get(ngoId) as Row | undefined;
  if (!n) return null;
  const grants = db.prepare("SELECT id, foundation_id, name, total_cents FROM grant_award WHERE ngo_id=? ORDER BY id").all(ngoId) as Row[];
  const trs = db.prepare("SELECT t.id, t.grant_id, t.seq, t.amount_cents, t.status FROM tranche t JOIN grant_award g ON g.id=t.grant_id WHERE g.ngo_id=? ORDER BY g.id, t.seq").all(ngoId) as Row[];

  const funderIds = [...new Set(grants.map((g) => g.foundation_id as number))];
  const funders: FunderFacility[] = funderIds.map((fid) => {
    const f = getFoundation(db, fid)!;
    const u = loadUtilization(db, { foundationId: fid, ngoId }, today);
    const mine = grants.filter((g) => g.foundation_id === fid);
    return {
      foundation: { id: f.id, name: f.name, fyModel: f.fyModel },
      fyLabel: fyLabel(u.utilization.startYear, f.fyModel),
      fyMonths: fyMonthsLabel(f.fyModel),
      range: fiscalYearRange(u.utilization.startYear, f.fyModel),
      utilization: u.utilization,
      grants: mine.map((g) => {
        const gc = grantCompliance(db, g.id, today)!;
        return {
          id: g.id, name: g.name, total_cents: g.total_cents,
          tranches: trs.filter((t) => t.grant_id === g.id).map((t) => ({ id: t.id, seq: t.seq, amount_cents: t.amount_cents, status: t.status })),
          compliance: { covenants: covenantRows(gc.evaluation), passed: gc.evaluation.passed, blockingOutstanding: gc.evaluation.blockingFailures.length },
        };
      }),
      actionable: trs
        .filter((t) => mine.some((g) => g.id === t.grant_id) && ["PENDING_EVIDENCE", "HELD"].includes(t.status))
        .map((t) => ({ trancheId: t.id, grantId: t.grant_id, grantName: mine.find((g) => g.id === t.grant_id)!.name, seq: t.seq, amount_cents: t.amount_cents, status: t.status })),
    };
  });

  const local = defaultLocalFY(n.country_code);
  return {
    ngo: { id: n.id, name: n.name, sector: n.sector, country_code: n.country_code, country_label: n.country_label, paypal_email: n.paypal_email, localFyModel: local, localFyMonths: fyMonthsLabel(local) },
    totals: {
      awardedCents: grants.reduce((s, g) => s + g.total_cents, 0),
      receivedCents: trs.filter((t) => t.status === "PAID").reduce((s, t) => s + t.amount_cents, 0),
      pendingLiquidityCents: trs.filter((t) => ["PENDING_EVIDENCE", "IN_REVIEW", "HELD", "RELEASING"].includes(t.status)).reduce((s, t) => s + t.amount_cents, 0),
    },
    funders,
    vault: getVault(db, ngoId),
  };
}
