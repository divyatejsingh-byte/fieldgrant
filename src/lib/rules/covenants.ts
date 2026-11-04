// Gate 1: deterministic compliance-covenant evaluation. Pure: no I/O, no clock (the date is a parameter).
// It runs BEFORE document extraction, so a blocked submission spends no model calls and can never reach payout.
import type { CovenantDefinition, CovenantState, GranteeDocumentRecord } from "@/types/grant";
import type { CheckResult } from "./types";

export type CovenantResult = {
  covenant: CovenantDefinition;
  state: CovenantState;
  passed: boolean;
  blocking: boolean;
  /** The vault record that was matched, if any. */
  record?: GranteeDocumentRecord;
  check: CheckResult;
};

export type ComplianceEvaluation = {
  /** True when every covenant is satisfied. */
  passed: boolean;
  results: CovenantResult[];
  satisfied: CovenantResult[];
  failing: CovenantResult[];
  /** Failing covenants marked payout-blocking: any of these means HOLD. */
  blockingFailures: CovenantResult[];
  /** One CheckResult per covenant, ready for the checks list. */
  checks: CheckResult[];
  /** Aggregate gate result. */
  summary: CheckResult;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * SAFETY notes:
 *  - `detail` strings may be shown to the explanation LLM, so they contain only the covenant NAME (set by the funder,
 *    length-limited at save time) and validated ISO dates. Free text typed by the grantee (document numbers) is never copied in.
 *  - A malformed expiry date fails closed (treated as expired).
 */
export function evaluateComplianceCovenants(
  covenants: CovenantDefinition[],
  vault: GranteeDocumentRecord[],
  today: Date = new Date(),
): ComplianceEvaluation {
  const todayISO = toISODate(today);

  const results: CovenantResult[] = covenants.map((covenant) => {
    // Several records for one covenant can only happen from hand-edited data; prefer one that is currently valid.
    const matches = vault.filter((v) => v.covenantId === covenant.id);
    const stateOf = (r: GranteeDocumentRecord): CovenantState =>
      r.status !== "ACTIVE" ? r.status : r.expiryDate && !(ISO_DATE.test(r.expiryDate) && r.expiryDate >= todayISO) ? "EXPIRED" : "ACTIVE";
    const record = matches.find((r) => stateOf(r) === "ACTIVE") ?? matches[matches.length - 1];
    const state: CovenantState = record ? stateOf(record) : "MISSING";
    const passed = state === "ACTIVE";
    const blocking = covenant.blocking !== false;
    const detail = passed
      ? `${covenant.name}: active${record?.expiryDate ? `, valid until ${record.expiryDate}` : ""}.`
      : `Missing or expired requirement: ${covenant.name}`;
    return {
      covenant, state, passed, blocking, record,
      check: { name: `covenant_${covenant.id}`, passed, severity: blocking ? "HARD" : "SOFT", detail, data: { covenant_id: covenant.id, covenant_name: covenant.name, state, blocking } },
    };
  });

  const failing = results.filter((r) => !r.passed);
  const blockingFailures = failing.filter((r) => r.blocking);
  const summary: CheckResult = {
    name: "statutory_compliance_gate",
    passed: failing.length === 0,
    severity: blockingFailures.length > 0 ? "HARD" : "SOFT",
    detail: failing.length === 0
      ? `All ${results.length} compliance covenants are satisfied.`
      : `Missing or expired requirement: ${failing.map((r) => r.covenant.name).join("; ")}`,
  };

  return {
    passed: failing.length === 0,
    results,
    satisfied: results.filter((r) => r.passed),
    failing,
    blockingFailures,
    checks: results.map((r) => r.check),
    summary,
  };
}

/** Compact, log-friendly lists for the ledger payload. Covenant names only; no grantee-typed text. */
export function compliancePayload(e: ComplianceEvaluation, todayISO: string) {
  return {
    evaluated_on: todayISO,
    covenants_total: e.results.length,
    covenants_satisfied: e.satisfied.map((r) => ({ id: r.covenant.id, name: r.covenant.name })),
    covenants_failing: e.failing.map((r) => ({ id: r.covenant.id, name: r.covenant.name, state: r.state, blocking: r.blocking })),
  };
}
