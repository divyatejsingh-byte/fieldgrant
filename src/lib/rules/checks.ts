// Pure compliance checks: no I/O, no clock, no randomness. Each returns {name, passed, severity, detail, data}.
// SAFETY: `detail` is a human sentence for the officer UI. `data` is the structured, numbers-and-dates-only payload that the
// explanation step receives INSTEAD of free text. Neither ever contains free text taken from documents (vendor name, memo,
// line-item descriptions), so injected text has no path into the explanation prompt.
import { formatUsd } from "../money";
import type { CheckData, CheckResult, RulesContext } from "./types";

const ok = (name: string, severity: CheckResult["severity"], detail: string, data?: CheckData): CheckResult => ({ name, passed: true, severity, detail, ...(data ? { data } : {}) });
const bad = (name: string, severity: CheckResult["severity"], detail: string, data?: CheckData): CheckResult => ({ name, passed: false, severity, detail, ...(data ? { data } : {}) });

/** HARD if over budget line + tolerance. Integer math in basis points, no floats. */
export function receiptTotalVsBudgetLine(c: RulesContext): CheckResult {
  const name = "receipt_total_vs_budget_line";
  const { totalCents } = c.extraction;
  const { budget_line_cents: line, tolerance_pct: tol, budget_line_label: label } = c.requirements;
  if (totalCents === null) return bad(name, "SOFT", "Receipt total could not be read from the document.", { budget_line_cents: line });
  const maxCents = Math.floor((line * (10000 + Math.round(tol * 100))) / 10000);
  // variance vs the budget line itself, to one decimal place, from integers (negative = under budget)
  const data: CheckData = { extracted_cents: totalCents, budget_line_cents: line, capped_cents: maxCents, tolerance_pct: tol, variance_pct: Math.round(((totalCents - line) * 1000) / line) / 10 };
  if (totalCents > maxCents) {
    const overPct = ((totalCents - line) * 100) / line;
    return bad(name, "HARD", `Receipt total ${formatUsd(totalCents)} exceeds the "${label}" budget line of ${formatUsd(line)} by ${overPct.toFixed(1)}% (allowed tolerance ${tol}%, maximum ${formatUsd(maxCents)}).`, data);
  }
  return ok(name, "HARD", `Receipt total ${formatUsd(totalCents)} is within the "${label}" budget line of ${formatUsd(line)} (+${tol}% tolerance).`, data);
}

export function receiptDateInGrantPeriod(c: RulesContext): CheckResult {
  const name = "receipt_date_in_grant_period";
  const d = c.extraction.dateISO;
  const { start_date: s, end_date: e } = c.grant;
  if (!d) return bad(name, "SOFT", "Receipt date could not be read from the document.", { grant_start: s, grant_end: e });
  const data: CheckData = { receipt_date: d, grant_start: s, grant_end: e };
  // ISO yyyy-mm-dd strings compare correctly as text.
  if (d < s || d > e) return bad(name, "HARD", `Receipt date ${d} is outside the grant period ${s} to ${e}.`, data);
  return ok(name, "HARD", `Receipt date ${d} is inside the grant period ${s} to ${e}.`, data);
}

/** SOFT if short by <=10% of the requirement, HARD if further short. */
export function attendeeCountMeetsRequirement(c: RulesContext): CheckResult {
  const name = "attendee_count_meets_requirement";
  const need = c.requirements.required_attendees;
  const got = c.extraction.attendeeCount;
  if (need <= 0) return ok(name, "SOFT", "No attendance requirement for this tranche.", { required: 0 });
  if (got === null) return bad(name, "SOFT", `No countable attendance list was found (photos or reports can't be counted automatically); ${need} required, so a person will review.`, { required: need });
  const data: CheckData = { extracted: got, required: need, shortfall: Math.max(need - got, 0) };
  if (got >= need) return ok(name, "SOFT", `Roster lists ${got} attendees; ${need} required.`, data);
  const short = need - got;
  if (short * 10 <= need) return bad(name, "SOFT", `Roster lists ${got} attendees, ${short} short of the ${need} required (small shortfall).`, data);
  return bad(name, "HARD", `Roster lists only ${got} attendees; ${need} required (${short} short).`, data);
}

export function lineItemsSumToTotal(c: RulesContext): CheckResult {
  const name = "line_items_sum_to_total";
  const { lineItems, totalCents } = c.extraction;
  const amounts = lineItems.map((i) => i.amountCents);
  if (totalCents === null || lineItems.length === 0 || amounts.some((a) => a === null))
    return bad(name, "SOFT", "Line items or total are missing or unreadable, so the sum cannot be verified.");
  const sum = (amounts as number[]).reduce((a, b) => a + b, 0);
  const data: CheckData = { line_items_sum_cents: sum, total_cents: totalCents };
  if (Math.abs(sum - totalCents) > 1) return bad(name, "SOFT", `Line items sum to ${formatUsd(sum)} but the receipt total is ${formatUsd(totalCents)}.`, data);
  return ok(name, "SOFT", `Line items sum to ${formatUsd(sum)}, matching the receipt total.`, data);
}

/** Independent of the model's total_text: scans the transcription lines labelled TOTAL (not SUBTOTAL). */
export function totalMatchesRegexPass(c: RulesContext): CheckResult {
  const name = "total_matches_regex_pass";
  const { totalCents, transcription } = c.extraction;
  if (totalCents === null) return bad(name, "SOFT", "No total to compare against the regex scan.");
  const found: number[] = [];
  for (const line of transcription.split(/\r?\n/)) {
    if (!/total/i.test(line) || /sub\s*-?\s*total/i.test(line)) continue;
    for (const m of line.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)) {
      const cents = toCents(m[0]);
      if (cents !== null) found.push(cents);
    }
  }
  const data: CheckData = { total_cents: totalCents, found_cents: found.slice(0, 5) };
  if (found.length === 0) return bad(name, "SOFT", "Regex scan found no TOTAL amount in the transcribed receipt text.", data);
  if (found.includes(totalCents)) return ok(name, "SOFT", `Regex scan independently found the total ${formatUsd(totalCents)}.`, data);
  return bad(name, "SOFT", `Regex scan found TOTAL amounts ${found.map(formatUsd).join(", ")} but the extracted total is ${formatUsd(totalCents)}.`, data);
}

/** Integer-only: BigInt arithmetic, then a safe-integer guard. Rejects anything that is not plain digits. */
function toCents(s: string): number | null {
  const [w, f = ""] = s.replace(/,/g, "").split(".");
  if (!/^\d{1,15}$/.test(w) || !/^\d*$/.test(f)) return null;
  const cents = BigInt(w) * 100n + BigInt(f.padEnd(2, "0").slice(0, 2));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

const where = (d: { ngoName: string; grantName: string }[]) => d.map((x) => `${x.ngoName} (grant "${x.grantName}")`).join("; ");
const heldBy = (d: { ngoName: string; grantName: string }[]) => d.slice(0, 3).map((x) => `${x.ngoName} / ${x.grantName}`);

export function duplicateFileHash(c: RulesContext): CheckResult {
  const name = "duplicate_file_hash";
  if (c.fileHashDuplicates.length > 0)
    return bad(name, "HARD", `This exact receipt file was already submitted earlier by ${where(c.fileHashDuplicates)}.`, { duplicate_count: c.fileHashDuplicates.length, held_by: heldBy(c.fileHashDuplicates) });
  return ok(name, "HARD", "No identical receipt file has been submitted by any NGO.", { duplicate_count: 0 });
}

export function duplicateVendorDateAmount(c: RulesContext): CheckResult {
  const name = "duplicate_vendor_date_amount";
  if (c.vendorDateAmountDuplicates.length > 0)
    return bad(name, "HARD", `A receipt with the same vendor, date and total was already submitted by ${where(c.vendorDateAmountDuplicates)}.`, { duplicate_count: c.vendorDateAmountDuplicates.length, held_by: heldBy(c.vendorDateAmountDuplicates) });
  return ok(name, "HARD", "No receipt with the same vendor, date and total exists across NGOs.", { duplicate_count: 0 });
}

export function spendCapNotExceeded(c: RulesContext): CheckResult {
  const name = "spend_cap_not_exceeded";
  const after = c.committedCents + c.trancheAmountCents;
  const cap = c.grant.spend_cap_cents;
  const data: CheckData = { committed_cents: c.committedCents, tranche_cents: c.trancheAmountCents, cap_cents: cap };
  if (after > cap) return bad(name, "HARD", `Releasing ${formatUsd(c.trancheAmountCents)} would bring grant disbursements to ${formatUsd(after)}, above the ${formatUsd(cap)} spend cap.`, data);
  return ok(name, "HARD", `Disbursements after this tranche would be ${formatUsd(after)}, within the ${formatUsd(cap)} cap.`, data);
}

/** SOFT: same item description priced more than 1.5x or less than 1/1.5 of an earlier tranche's price from this vendor. */
export function vendorConsistencyAcrossTranches(c: RulesContext): CheckResult {
  const name = "vendor_consistency_across_tranches";
  if (c.priorVendorPrices.length === 0) return ok(name, "SOFT", "No earlier receipts from this vendor on this grant to compare.");
  for (const li of c.extraction.lineItems) {
    if (li.unitCents === null || li.unitCents <= 0) continue;
    const prior = c.priorVendorPrices.find((p) => p.description.trim().toLowerCase() === li.description.trim().toLowerCase());
    if (!prior || prior.unitCents <= 0) continue;
    if (li.unitCents * 2 > prior.unitCents * 3 || li.unitCents * 3 < prior.unitCents * 2)
      return bad(name, "SOFT", `A line item's unit price ${formatUsd(li.unitCents)} differs sharply from ${formatUsd(prior.unitCents)} paid to the same vendor earlier on this grant.`, { unit_cents: li.unitCents, prior_unit_cents: prior.unitCents });
  }
  return ok(name, "SOFT", "Unit prices are consistent with earlier receipts from this vendor.");
}

/** SOFT: a bulk line item (qty > 1) should roughly match the roster headcount (within 10%). */
export function crossSourceCorroboration(c: RulesContext): CheckResult {
  const name = "cross_source_corroboration";
  const roster = c.extraction.attendeeCount;
  const bulk = c.extraction.lineItems.filter((i) => i.quantity !== null && i.quantity > 1);
  if (roster === null || roster === 0 || bulk.length === 0) return ok(name, "SOFT", "Nothing to cross-check between receipt quantities and the roster.");
  const data: CheckData = { roster_headcount: roster, quantities: bulk.slice(0, 5).map((i) => i.quantity as number) };
  if (bulk.some((i) => Math.abs((i.quantity as number) - roster) * 10 <= roster))
    return ok(name, "SOFT", `A receipt line item quantity agrees with the roster headcount of ${roster}.`, data);
  return bad(name, "SOFT", `No receipt line item quantity (${bulk.map((i) => i.quantity).join(", ")}) agrees with the roster headcount of ${roster}.`, data);
}

export function runAllChecks(c: RulesContext): CheckResult[] {
  return [
    receiptTotalVsBudgetLine(c),
    receiptDateInGrantPeriod(c),
    attendeeCountMeetsRequirement(c),
    lineItemsSumToTotal(c),
    totalMatchesRegexPass(c),
    duplicateFileHash(c),
    duplicateVendorDateAmount(c),
    spendCapNotExceeded(c),
    vendorConsistencyAcrossTranches(c),
    crossSourceCorroboration(c),
  ];
}
