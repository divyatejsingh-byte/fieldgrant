import { describe, expect, it } from "vitest";
import {
  crossesFiscalBoundary, defaultLocalFY, fiscalYearRange, fiscalYearStart, fyLabel, fyMonthsLabel, getFiscalYear, inFiscalYear, isFYModel,
} from "../src/lib/fiscal-year";

describe("getFiscalYear", () => {
  it.each([
    ["2026-01-01", "CALENDAR", "FY2026"],
    ["2026-12-31", "CALENDAR", "FY2026"],
    ["2026-03-31", "APRIL_MARCH", "FY2025-26"],
    ["2026-04-01", "APRIL_MARCH", "FY2026-27"],
    ["2027-03-31", "APRIL_MARCH", "FY2026-27"],
    ["2026-06-30", "JULY_JUNE", "FY2025-26"],
    ["2026-07-01", "JULY_JUNE", "FY2026-27"],
    ["2026-09-30", "OCTOBER_SEPTEMBER", "FY2025-26"],
    ["2026-10-01", "OCTOBER_SEPTEMBER", "FY2026-27"],
    ["2099-12-31", "APRIL_MARCH", "FY2099-00"],
  ] as const)("%s under %s -> %s", (date, model, label) => expect(getFiscalYear(date, model)).toBe(label));

  it("accepts a Date (UTC) and ignores any time part of a string", () => {
    expect(getFiscalYear(new Date(Date.UTC(2026, 3, 1)), "APRIL_MARCH")).toBe("FY2026-27");
    expect(getFiscalYear("2026-03-31 23:59:59", "APRIL_MARCH")).toBe("FY2025-26");
  });
  it("handles leap days", () => expect(getFiscalYear("2028-02-29", "CALENDAR")).toBe("FY2028"));
  it.each(["", "2026-13-01", "2026-02-30", "not a date", "26-01-01"])("rejects %j", (bad) => expect(() => getFiscalYear(bad, "CALENDAR")).toThrow(RangeError));
  it("rejects an invalid Date", () => expect(() => getFiscalYear(new Date("x"), "CALENDAR")).toThrow(RangeError));
});

describe("ranges and labels", () => {
  it("returns inclusive ISO ranges", () => {
    expect(fiscalYearRange(2026, "CALENDAR")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(fiscalYearRange(2026, "APRIL_MARCH")).toEqual({ start: "2026-04-01", end: "2027-03-31" });
    expect(fiscalYearRange(2026, "JULY_JUNE")).toEqual({ start: "2026-07-01", end: "2027-06-30" });
    expect(fiscalYearRange(2026, "OCTOBER_SEPTEMBER")).toEqual({ start: "2026-10-01", end: "2027-09-30" });
    expect(fiscalYearRange(2027, "APRIL_MARCH").end).toBe("2028-03-31");
  });
  it("range endpoints belong to their own FY and the neighbours do not", () => {
    for (const m of ["CALENDAR", "APRIL_MARCH", "JULY_JUNE", "OCTOBER_SEPTEMBER"] as const) {
      const r = fiscalYearRange(2026, m);
      expect(inFiscalYear(r.start, 2026, m)).toBe(true);
      expect(inFiscalYear(r.end, 2026, m)).toBe(true);
      expect(fiscalYearStart(fiscalYearRange(2027, m).start, m)).toBe(2027);
    }
  });
  it("month labels", () => {
    expect(fyMonthsLabel("CALENDAR")).toBe("Jan–Dec");
    expect(fyMonthsLabel("APRIL_MARCH")).toBe("Apr–Mar");
    expect(fyMonthsLabel("JULY_JUNE")).toBe("Jul–Jun");
    expect(fyMonthsLabel("OCTOBER_SEPTEMBER")).toBe("Oct–Sep");
  });
  it("fyLabel", () => {
    expect(fyLabel(2026, "CALENDAR")).toBe("FY2026");
    expect(fyLabel(2026, "JULY_JUNE")).toBe("FY2026-27");
  });
  it("isFYModel", () => {
    expect(isFYModel("CALENDAR")).toBe(true);
    expect(isFYModel("MARCH_APRIL")).toBe(false);
    expect(isFYModel(undefined)).toBe(false);
  });
});

describe("country mapping and cross-FY", () => {
  it.each([["IN", "APRIL_MARCH"], ["GB", "APRIL_MARCH"], ["US", "CALENDAR"], ["KE", "JULY_JUNE"], ["BD", "JULY_JUNE"], ["in", "APRIL_MARCH"], ["ZZ", "CALENDAR"], [null, "CALENDAR"]] as const)(
    "%s -> %s", (cc, model) => expect(defaultLocalFY(cc)).toBe(model),
  );
  it("flags dates that fall in different numbered years for funder vs grantee", () => {
    expect(crossesFiscalBoundary("2026-02-10", "CALENDAR", "APRIL_MARCH")).toBe(true); // FY2026 vs FY2025-26
    expect(crossesFiscalBoundary("2026-10-14", "CALENDAR", "APRIL_MARCH")).toBe(false); // both start in 2026
    expect(crossesFiscalBoundary("2026-10-14", "CALENDAR", "CALENDAR")).toBe(false);
    expect(crossesFiscalBoundary("2026-04-08", "CALENDAR", "JULY_JUNE")).toBe(true);
  });
});
