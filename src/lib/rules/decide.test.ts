import { describe, expect, it } from "vitest";
import { decide } from "./decide";
import type { CheckResult } from "./types";

const pass = (name: string, severity: CheckResult["severity"] = "HARD"): CheckResult => ({ name, passed: true, severity, detail: "ok" });
const fail = (name: string, severity: CheckResult["severity"]): CheckResult => ({ name, passed: false, severity, detail: "nope" });
const reliable = { reliable: true, reasons: [] };
const unreliable = { reliable: false, reasons: ["runs disagree"] };

describe("decide", () => {
  it("RELEASE when all pass and reliable", () => expect(decide([pass("a"), pass("b", "SOFT")], reliable).decision).toBe("RELEASE"));
  it("OFFICER_REVIEW on a SOFT failure", () => expect(decide([pass("a"), fail("b", "SOFT")], reliable).decision).toBe("OFFICER_REVIEW"));
  it("HOLD on a HARD failure", () => expect(decide([fail("receipt_total_vs_budget_line", "HARD")], reliable).decision).toBe("HOLD"));
  it("HOLD beats SOFT failures", () => expect(decide([fail("x", "HARD"), fail("y", "SOFT")], reliable).decision).toBe("HOLD"));
  it("OFFICER_REVIEW when extraction is unreliable even if all checks pass", () => {
    const r = decide([pass("a")], unreliable);
    expect(r.decision).toBe("OFFICER_REVIEW");
    expect(r.reasons).toContain("runs disagree");
  });
  it("unreliable extraction turns an extraction-dependent HARD failure into review", () =>
    expect(decide([fail("receipt_total_vs_budget_line", "HARD")], unreliable).decision).toBe("OFFICER_REVIEW"));
  it("duplicate_file_hash HOLDs even when extraction is unreliable", () =>
    expect(decide([fail("duplicate_file_hash", "HARD")], unreliable).decision).toBe("HOLD"));
  it("spend_cap HOLDs even when extraction is unreliable", () =>
    expect(decide([fail("spend_cap_not_exceeded", "HARD")], unreliable).decision).toBe("HOLD"));
  it("never RELEASEs when any check fails", () => {
    for (const sev of ["HARD", "SOFT"] as const) for (const rel of [reliable, unreliable]) expect(decide([fail("z", sev)], rel).decision).not.toBe("RELEASE");
  });
  it("includes the reasons for a HOLD", () => expect(decide([fail("x", "HARD")], reliable).reasons[0]).toContain("x:"));
});
