import { describe, expect, it } from "vitest";
import { bps, committedInFiscalYear, computeFiscalUtilization, type GrantRow, type SubmissionRow, type TrancheRow } from "../src/lib/analytics";
import { loadUtilization } from "../src/lib/analytics-data";
import { FY_MODELS, fiscalYearRange } from "../src/lib/fiscal-year";
import { applyBatchDetails, overrideDecision, releaseTranche } from "../src/lib/payout/service";
import { processSubmission } from "../src/lib/pipeline";
import { cleanRawExtraction } from "../src/lib/rules/fixtures";
import { getFoundation, listFoundations, setFoundationFyModel } from "../src/lib/foundations";
import { loadGranteeOverview, loadGrantmakerOverview } from "../src/lib/overview";
import { ledgerRows, ngoDetail, reviewQueue } from "../src/lib/queries";
import { fakeFile, fakePayPal, freshDb, mockLlm, NGO1_T2, NGO2_T2 } from "./helpers";

const grant = (over: Partial<GrantRow> = {}): GrantRow => ({ id: 1, start_date: "2026-01-01", end_date: "2026-12-31", total_cents: 1_000_000, ...over });
const tr = (over: Partial<TrancheRow> = {}): TrancheRow => ({ id: 1, grant_id: 1, amount_cents: 250_000, status: "PAID", disbursed_at: "2026-03-12 09:00:00", ...over });
const sub = (over: Partial<SubmissionRow> = {}): SubmissionRow => ({ id: 1, tranche_id: 1, decision: "RELEASE", receipt_date: "2026-10-14", receipt_cents: 250_000, ...over });

describe("committed capital (pro-rated, integer cents)", () => {
  it("a grant inside one FY is committed in full", () => {
    const r = fiscalYearRange(2026, "CALENDAR");
    expect(committedInFiscalYear(grant(), r.start, r.end)).toBe(1_000_000);
  });
  it("a grant spanning two FYs is split by days", () => {
    const g = grant({ start_date: "2026-06-01", end_date: "2027-05-31", total_cents: 400_000 });
    const a = fiscalYearRange(2026, "CALENDAR");
    const b = fiscalYearRange(2027, "CALENDAR");
    expect(committedInFiscalYear(g, a.start, a.end)).toBe(234_520); // 214 of 365 days, floored
    expect(committedInFiscalYear(g, b.start, b.end)).toBe(165_480);
  });
  it("shares across consecutive FYs always sum to exactly the award, for every FY model", () => {
    const g = grant({ start_date: "2026-02-17", end_date: "2028-11-03", total_cents: 1_000_003 });
    for (const m of FY_MODELS) {
      let sum = 0;
      for (let y = 2025; y <= 2029; y++) { const r = fiscalYearRange(y, m); sum += committedInFiscalYear(g, r.start, r.end); }
      expect(sum).toBe(1_000_003);
    }
  });
  it("is zero outside the grant window", () => {
    const r = fiscalYearRange(2030, "CALENDAR");
    expect(committedInFiscalYear(grant(), r.start, r.end)).toBe(0);
  });
});

describe("computeFiscalUtilization", () => {
  const run = (g: GrantRow[], t: TrancheRow[], s: SubmissionRow[], model = "CALENDAR" as const, year = 2026) => computeFiscalUtilization(g, t, s, model, year);

  it("counts PAID and RELEASING by dispatch date, ignores other statuses and missing dates", () => {
    const u = run([grant()], [
      tr({ id: 1, status: "PAID" }),
      tr({ id: 2, status: "RELEASING", amount_cents: 500_000, disbursed_at: "2026-10-20 10:00:00" }),
      tr({ id: 3, status: "PENDING_EVIDENCE" }),
      tr({ id: 4, status: "HELD", disbursed_at: "2026-05-01 00:00:00" }),
      tr({ id: 5, status: "PAID", disbursed_at: null }),
      tr({ id: 6, status: "PAID", disbursed_at: "2025-12-31 23:59:59" }), // previous FY
    ], []);
    expect(u.disbursedCents).toBe(750_000);
  });

  it("counts only approved submissions by RECEIPT date, never HOLD or REVIEW", () => {
    const u = run([grant()], [], [
      sub({ id: 1, tranche_id: 1 }),
      sub({ id: 2, tranche_id: 2, decision: "HOLD" }),
      sub({ id: 3, tranche_id: 3, decision: "OFFICER_REVIEW" }),
      sub({ id: 4, tranche_id: 4, receipt_date: "2025-12-31" }),
      sub({ id: 5, tranche_id: 5, receipt_cents: null }),
    ]);
    expect(u.utilizedCents).toBe(250_000);
  });

  it("a resubmission for the same tranche is never double-counted (latest approved wins)", () => {
    const u = run([grant()], [], [sub({ id: 1, receipt_cents: 100_000 }), sub({ id: 2, receipt_cents: 250_000 })]);
    expect(u.utilizedCents).toBe(250_000);
  });

  it("float is disbursed minus utilized, and can be negative", () => {
    const pos = run([grant()], [tr()], [sub({ receipt_cents: 100_000 })]);
    expect(pos.floatCents).toBe(150_000);
    const neg = run([grant()], [], [sub()]);
    expect(neg.floatCents).toBe(-250_000);
    expect(neg.bar.floatCents).toBe(0);
  });

  it("bar segments never overlap: verified + float = disbursed; unreleased = committed - disbursed", () => {
    const u = run([grant()], [tr()], [sub({ receipt_cents: 100_000 })]);
    expect(u.bar).toEqual({ verifiedCents: 100_000, floatCents: 150_000, unreleasedCents: 750_000, totalCents: 1_000_000 });
    expect(u.bar.verifiedCents + u.bar.floatCents).toBe(u.disbursedCents);
  });

  it("percentages are integer basis points of committed", () => {
    const u = run([grant({ total_cents: 2_300_000 })], [tr({ amount_cents: 1_250_000 })], [sub({ receipt_cents: 1_000_000 })]);
    expect(u.disbursedBps).toBe(5435); // 54.35%
    expect(u.utilizedBps).toBe(4348); // 43.48%
  });

  it("zero committed gives null percentages, not NaN or Infinity", () => {
    const u = run([], [], []);
    expect(u.disbursedBps).toBeNull();
    expect(u.utilizedBps).toBeNull();
  });

  it("the FY model changes attribution", () => {
    const t = [tr({ disbursed_at: "2026-03-12 09:00:00" })];
    expect(computeFiscalUtilization([grant()], t, [], "CALENDAR", 2026).disbursedCents).toBe(250_000);
    expect(computeFiscalUtilization([grant()], t, [], "APRIL_MARCH", 2026).disbursedCents).toBe(0); // Mar 2026 is in FY2025-26
    expect(computeFiscalUtilization([grant()], t, [], "APRIL_MARCH", 2025).disbursedCents).toBe(250_000);
  });
});

describe("bps", () => {
  it.each([[1, 3, 3333], [2, 3, 6667], [1, 2, 5000], [0, 5, 0], [5, 5, 10_000]])("bps(%i,%i) = %i", (a, b, e) => expect(bps(a, b)).toBe(e));
  it("no float drift on odd cent amounts", () => expect(bps(1_000_001, 3_000_003)).toBe(3333));
});

const GH = 1;
const WS = 2;
const BG = 3;
const TODAY = new Date(Date.UTC(2026, 10, 2));

describe("many-to-many funders and grantees (seed)", () => {
  it("CleanWater holds grants from two funders; Wellspring funds two NGOs", () => {
    const db = freshDb();
    const funderIds = (db.prepare("SELECT DISTINCT foundation_id f FROM grant_award WHERE ngo_id=1 ORDER BY f").all() as { f: number }[]).map((r) => r.f);
    const ngoIds = (db.prepare("SELECT DISTINCT ngo_id n FROM grant_award WHERE foundation_id=? ORDER BY n").all(WS) as { n: number }[]).map((r) => r.n);
    expect(funderIds).toEqual([GH, WS]);
    expect(ngoIds).toEqual([1, 2]);
  });

  it("each funder carries its own default FY model", () => {
    const db = freshDb();
    expect(listFoundations(db).map((f) => [f.name, f.fyModel])).toEqual([
      ["Global Horizon Foundation", "CALENDAR"],
      ["Wellspring Health Trust", "APRIL_MARCH"],
      ["Beacon Global Giving", "CALENDAR"],
    ]);
  });

  it("grant 4 is $6,000 from Wellspring in three tranches of 30/40/30", () => {
    const db = freshDb();
    const g = db.prepare("SELECT id, total_cents, foundation_id, ngo_id FROM grant_award WHERE id=4").get() as { id: number; total_cents: number; foundation_id: number; ngo_id: number };
    expect(g).toMatchObject({ total_cents: 600_000, foundation_id: WS, ngo_id: 1 });
    const amounts = (db.prepare("SELECT amount_cents a FROM tranche WHERE grant_id=4 ORDER BY seq").all() as { a: number }[]).map((r) => r.a);
    expect(amounts).toEqual([180_000, 240_000, 180_000]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(600_000);
  });

  it("ngoDetail can be scoped to one funder", () => {
    const db = freshDb();
    expect(ngoDetail(db, 1)?.grants).toHaveLength(2);
    expect(ngoDetail(db, 1, GH)?.grants.map((g) => g.id)).toEqual([1]);
    expect(ngoDetail(db, 1, WS)?.grants.map((g) => g.id)).toEqual([4]);
  });
});

describe("per-funder utilization with the real database, pipeline and payouts", () => {
  it("every funder is computed in ITS OWN fiscal-year model", () => {
    const db = freshDb();
    const gh = loadUtilization(db, { foundationId: GH }, TODAY);
    const ws = loadUtilization(db, { foundationId: WS }, TODAY);
    const bg = loadUtilization(db, { foundationId: BG }, TODAY);
    expect(gh.utilization).toMatchObject({ label: "FY2026", committedCents: 1_000_000, disbursedCents: 250_000, utilizedCents: 0 });
    expect(ws.utilization).toMatchObject({ label: "FY2026-27", committedCents: 1_094_012, disbursedCents: 330_000, utilizedCents: 0 });
    expect(ws.utilization.range).toEqual({ start: "2026-04-01", end: "2027-03-31" });
    expect(bg.utilization).toMatchObject({ label: "FY2026", committedCents: 234_520, disbursedCents: 0 });
    expect(ws.years.map((y) => y.label)).toEqual(["FY2025-26", "FY2026-27", "FY2027-28"]);
  });

  it("changing one funder's model re-buckets only that funder", () => {
    const db = freshDb();
    expect(setFoundationFyModel(db, WS, "CALENDAR")).toBe(true);
    const ws = loadUtilization(db, { foundationId: WS }, TODAY).utilization;
    expect(ws).toMatchObject({ label: "FY2026", committedCents: 1_052_054, disbursedCents: 330_000 });
    expect(getFoundation(db, GH)?.fyModel).toBe("CALENDAR");
    expect(getFoundation(db, BG)?.fyModel).toBe("CALENDAR");
  });

  it("an unknown funder is rejected", () => expect(() => loadUtilization(freshDb(), { foundationId: 99 }, TODAY)).toThrow(RangeError));

  it("grantee view: one card per funder, each in that funder's FY, narrowed to the NGO", () => {
    const db = freshDb();
    const g = loadGranteeOverview(db, 1, TODAY)!;
    expect(g.funders.map((f) => [f.foundation.name, f.fyLabel, f.fyMonths])).toEqual([
      ["Global Horizon Foundation", "FY2026", "Jan–Dec"],
      ["Wellspring Health Trust", "FY2026-27", "Apr–Mar"],
    ]);
    const ws = g.funders[1];
    expect(ws.utilization).toMatchObject({ committedCents: 600_000, disbursedCents: 180_000 }); // CleanWater's grant only, not HealthBridge's
    expect(g.totals).toEqual({ awardedCents: 1_600_000, receivedCents: 430_000, pendingLiquidityCents: 740_000 });
    expect(ws.actionable.map((a) => a.trancheId)).toEqual([11]);
    expect(g.ngo).toMatchObject({ country_code: "IN", localFyModel: "APRIL_MARCH", localFyMonths: "Apr–Mar" });
  });

  it("a single-funder NGO gets a single card", () => {
    const g = loadGranteeOverview(freshDb(), 2, TODAY)!;
    expect(g.funders).toHaveLength(1);
    expect(g.funders[0].utilization.committedCents).toBe(494_012);
    expect(g.ngo.localFyModel).toBe("JULY_JUNE");
  });

  it("grantmaker overview: sectors, tranche health and cohort follow the active funder", () => {
    const db = freshDb();
    const ws = loadGrantmakerOverview(db, WS, undefined, TODAY);
    expect(ws.cohort.map((c) => c.ngo.name)).toEqual(["CleanWater Initiative", "HealthBridge Vaccine Drive"]);
    expect(ws.sectors.map((s) => s.sector).sort()).toEqual(["Public health", "Sanitation"]);
    expect(ws.sectors.every((s) => s.awardedCents === 600_000 && s.ngoCount === 1)).toBe(true);
    expect(ws.trancheHealth).toMatchObject({ PAID: 2, PENDING_EVIDENCE: 2, LOCKED: 2, IN_REVIEW: 0, HELD: 0 });
    const gh = loadGrantmakerOverview(db, GH, undefined, TODAY);
    expect(gh.cohort.map((c) => c.ngo.name)).toEqual(["CleanWater Initiative"]);
    expect(gh.cohort[0].grants.map((x) => x.id)).toEqual([1]); // not Wellspring's grant to the same NGO
  });

  it("approving evidence and dispatching the payout moves only the paying funder's figures", async () => {
    const db = freshDb();
    const r = await processSubmission({ db, llm: mockLlm(cleanRawExtraction()) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile(), memoText: "ok" });
    let gh = loadUtilization(db, { foundationId: GH }, TODAY).utilization;
    expect(gh).toMatchObject({ utilizedCents: 250_000, disbursedCents: 250_000 }); // approved, not yet paid

    await releaseTranche(db, fakePayPal(), r.submissionId);
    expect((db.prepare("SELECT disbursed_at FROM tranche WHERE id=2").get() as { disbursed_at: string | null }).disbursed_at).not.toBeNull();
    db.prepare("UPDATE tranche SET disbursed_at='2026-10-20 10:00:00' WHERE id=2").run(); // pin the date so the test is clock-independent
    gh = loadUtilization(db, { foundationId: GH }, TODAY).utilization;
    expect(gh).toMatchObject({ disbursedCents: 750_000, utilizedCents: 250_000, floatCents: 500_000 });
    expect(loadUtilization(db, { foundationId: WS }, TODAY).utilization).toMatchObject({ disbursedCents: 330_000, utilizedCents: 0 });
  });

  it("an officer-approved overspend counts the receipt total", async () => {
    const db = freshDb();
    const over = cleanRawExtraction({ total_text: "$3,250.00", receipt_transcription: "TOTAL $3,250.00" });
    const r = await processSubmission({ db, llm: mockLlm(over) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile() });
    expect(r.decision).toBe("HOLD");
    expect(loadUtilization(db, { foundationId: GH }, TODAY).utilization.utilizedCents).toBe(0);
    await overrideDecision(db, fakePayPal(), { submissionId: r.submissionId, newDecision: "RELEASE", reason: "Approved variance" });
    expect(loadUtilization(db, { foundationId: GH }, TODAY).utilization.utilizedCents).toBe(325_000);
  });

  it("a payout that PayPal reports FAILED is removed from disbursed capital", async () => {
    const db = freshDb();
    const r = await processSubmission({ db, llm: mockLlm(cleanRawExtraction()) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile() });
    await releaseTranche(db, fakePayPal(), r.submissionId);
    applyBatchDetails(db, "BATCH-TEST-1", { batchStatus: "SUCCESS", items: [{ payoutItemId: "I", transactionStatus: "FAILED" }] }, "SYSTEM");
    expect(db.prepare("SELECT disbursed_at, status FROM tranche WHERE id=2").get()).toEqual({ disbursed_at: null, status: "HELD" });
    expect(loadUtilization(db, { foundationId: GH }, TODAY).utilization.disbursedCents).toBe(250_000);
  });

  it("the review queue and the ledger are scoped to the funder", async () => {
    const db = freshDb();
    const r = await processSubmission({ db, llm: mockLlm(new Error("model down")) }, { ...NGO2_T2, receipt: fakeFile(), roster: fakeFile() });
    expect(r.decision).toBe("OFFICER_REVIEW");
    expect(reviewQueue(db, WS)).toHaveLength(1);
    expect(reviewQueue(db, GH)).toHaveLength(0);
    expect(reviewQueue(db)).toHaveLength(1);
    const wsLedger = ledgerRows(db, { foundationId: WS }) as { grant_name: string }[];
    expect(wsLedger.length).toBeGreaterThan(0);
    expect(wsLedger.every((l) => ["Village Immunization Drive 2026", "Clinic Handwashing and Sanitation 2026-27"].includes(l.grant_name))).toBe(true);
    expect((ledgerRows(db, { foundationId: GH }) as { grant_name: string }[]).every((l) => l.grant_name === "Community Sanitation Units 2026")).toBe(true);
  });
});
