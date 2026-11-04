import { describe, expect, it } from "vitest";
import { centsToDecimalString, formatUsd, MoneyParseError, parseMoneyToCents } from "./money";

describe("parseMoneyToCents", () => {
  it.each([
    ["$1,050.0", 105000],
    ["$2,500.00", 250000],
    ["1.050,00", 105000],
    ["USD 12", 1200],
    ["0.07", 7],
    ["1,050", 105000],
    ["19.99", 1999],
    ["$0.10", 10],
  ])("%s -> %i", (input, cents) => expect(parseMoneyToCents(input)).toBe(cents));

  it("avoids float drift", () => expect(parseMoneyToCents("1.15")).toBe(115));
  it.each(["", "abc", "-5", "1.2345"])("rejects %j", (bad) => expect(() => parseMoneyToCents(bad)).toThrow(MoneyParseError));
});

describe("formatting", () => {
  it("decimal string for PayPal", () => expect(centsToDecimalString(250005)).toBe("2500.05"));
  it("rejects non-integers", () => expect(() => centsToDecimalString(1.5)).toThrow());
  it("display", () => expect(formatUsd(105000)).toBe("$1,050.00"));
});
