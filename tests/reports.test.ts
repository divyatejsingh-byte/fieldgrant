import { describe, expect, it } from "vitest";
import { createReport, listReports, ReportError, validatePeriod } from "../src/lib/reports";
import { fakeFile, freshDb } from "./helpers";

// Seed: ngo 1 (CleanWater) has grants from Global Horizon (1,2) and Wellspring (4); ngo 2 has its own.
const mk = (db: ReturnType<typeof freshDb>, o: Partial<Parameters<typeof createReport>[1]> = {}) =>
  createReport(db, { ngoId: 1, grantId: 1, type: "QUARTERLY", period: "2026-Q3", file: fakeFile(), fileName: "q3.pdf", ...o });

describe("report periods", () => {
  it("accepts a well-formed period for each type", () => {
    expect(() => validatePeriod("MONTHLY", "2026-10")).not.toThrow();
    expect(() => validatePeriod("QUARTERLY", "2026-Q4")).not.toThrow();
    expect(() => validatePeriod("ANNUAL", "2026")).not.toThrow();
  });
  it("rejects a period that does not match the type", () => {
    expect(() => validatePeriod("MONTHLY", "2026-13")).toThrow(ReportError);
    expect(() => validatePeriod("QUARTERLY", "2026-Q5")).toThrow(ReportError);
    expect(() => validatePeriod("ANNUAL", "2026-Q1")).toThrow(ReportError);
    expect(() => validatePeriod("ANNUAL", "1999")).toThrow(ReportError);
  });
});

describe("sharing reports with funders", () => {
  it("a shared report is listed for the grantee and for the funder of that grant", () => {
    const db = freshDb();
    const id = mk(db);
    expect(listReports(db, { ngoId: 1 }).map((r) => r.id)).toContain(id);
    const grantFunder = (db.prepare("SELECT foundation_id f FROM grant_award WHERE id=1").get() as { f: number }).f;
    expect(listReports(db, { foundationId: grantFunder }).map((r) => r.id)).toContain(id);
  });

  it("another funder never sees it", () => {
    const db = freshDb();
    mk(db);
    const grantFunder = (db.prepare("SELECT foundation_id f FROM grant_award WHERE id=1").get() as { f: number }).f;
    const other = (db.prepare("SELECT id FROM foundation WHERE id<>? LIMIT 1").get(grantFunder) as { id: number }).id;
    expect(listReports(db, { foundationId: other })).toEqual([]);
  });

  it("a grantee cannot report on someone else's grant", () => {
    const db = freshDb();
    const theirs = (db.prepare("SELECT id FROM grant_award WHERE ngo_id=2 LIMIT 1").get() as { id: number }).id;
    expect(() => mk(db, { grantId: theirs })).toThrow(ReportError);
  });

  it("monthly reports are optional extras and are stored like any other", () => {
    const db = freshDb();
    mk(db, { type: "MONTHLY", period: "2026-10" });
    expect(listReports(db, { ngoId: 1 })[0].period_type).toBe("MONTHLY");
  });

  it("sanitizes the file name and note, and caps their length", () => {
    const db = freshDb();
    mk(db, { fileName: "../../etc/pass\u0000wd.pdf", note: "x".repeat(900) });
    const r = listReports(db, { ngoId: 1 })[0];
    expect(r.file_name).toBe("pass wd.pdf");
    expect(r.note!.length).toBe(500);
  });
});
