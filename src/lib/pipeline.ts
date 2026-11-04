// Submission pipeline: intake -> extract x2 -> normalize -> checks -> DECIDE (code) -> explain (LLM, after) -> ledger.
import fs from "node:fs";
import type Database from "better-sqlite3";
import { extractDualPass } from "./extraction/extract";
import { assessReliability, type RunOutcome } from "./extraction/reliability";
import { generateAuditExplanation } from "./explain";
import { writeLedger } from "./ledger";
import type { LlmFile, LlmProvider } from "./llm/types";
import { parseCovenants, parseVault } from "./compliance";
import { runAllChecks } from "./rules/checks";
import { compliancePayload, evaluateComplianceCovenants, toISODate } from "./rules/covenants";
import { decide } from "./rules/decide";
import type { CheckResult, Decision, NormalizedExtraction, Requirements, RulesContext } from "./rules/types";
import type { StoredFile } from "./uploads";

export class PipelineError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export type TrancheRow = { id: number; grant_id: number; seq: number; amount_cents: number; requirements: string; status: string };
export type GrantRow = { id: number; ngo_id: number; covenants: string; name: string; total_cents: number; start_date: string; end_date: string; spend_cap_cents: number };

export type SubmissionResult = {
  submissionId: number;
  decision: Decision;
  reasons: string[];
  checks: CheckResult[];
  explanation: string;
  remediationNote: string;
  trancheStatus: string;
};

const EMPTY: NormalizedExtraction = { vendor: null, vendorKey: null, dateISO: null, totalCents: null, lineItems: [], attendeeCount: null, transcription: "" };

function loadContext(db: Database.Database, submissionId: number, tranche: TrancheRow, grant: GrantRow, norm: NormalizedExtraction, receiptHash: string): RulesContext {
  const committed = db
    .prepare("SELECT COALESCE(SUM(amount_cents),0) AS c FROM tranche WHERE grant_id=? AND id<>? AND status IN ('PAID','RELEASING')")
    .get(grant.id, tranche.id) as { c: number };

  const refs = (sql: string, ...args: unknown[]) =>
    (db.prepare(sql).all(...args) as { id: number; ngo: string; grant: string }[]).map((r) => ({ submissionId: r.id, ngoName: r.ngo, grantName: r.grant }));
  const base = `SELECT s.id, n.name AS ngo, g.name AS grant FROM submission s JOIN tranche t ON t.id=s.tranche_id JOIN grant_award g ON g.id=t.grant_id JOIN ngo n ON n.id=g.ngo_id`;

  // Cross-NGO on purpose: duplicate evidence is checked across ALL NGOs and grants.
  const fileHashDuplicates = refs(`${base} WHERE s.id<>? AND json_extract(s.file_hashes,'$.receipt')=?`, submissionId, receiptHash);
  const vendorDateAmountDuplicates =
    norm.vendorKey && norm.dateISO && norm.totalCents !== null
      ? refs(
          `${base} WHERE s.id<>? AND json_extract(s.extracted_final,'$.normalized.vendorKey')=? AND json_extract(s.extracted_final,'$.normalized.dateISO')=? AND json_extract(s.extracted_final,'$.normalized.totalCents')=?`,
          submissionId, norm.vendorKey, norm.dateISO, norm.totalCents,
        )
      : [];

  const priorVendorPrices: RulesContext["priorVendorPrices"] = [];
  if (norm.vendorKey) {
    const prior = db
      .prepare(
        `SELECT s.extracted_final AS f FROM submission s JOIN tranche t ON t.id=s.tranche_id
         WHERE t.grant_id=? AND s.id<>? AND json_extract(s.extracted_final,'$.normalized.vendorKey')=?`,
      )
      .all(grant.id, submissionId, norm.vendorKey) as { f: string }[];
    for (const p of prior)
      for (const li of (JSON.parse(p.f).normalized as NormalizedExtraction).lineItems)
        if (li.unitCents) priorVendorPrices.push({ description: li.description, unitCents: li.unitCents });
  }

  return {
    extraction: norm,
    requirements: JSON.parse(tranche.requirements) as Requirements,
    grant: { start_date: grant.start_date, end_date: grant.end_date, spend_cap_cents: grant.spend_cap_cents },
    trancheAmountCents: tranche.amount_cents,
    committedCents: committed.c,
    fileHashDuplicates,
    vendorDateAmountDuplicates,
    priorVendorPrices,
  };
}

export type PipelineDeps = {
  db: Database.Database;
  llm: LlmProvider;
  /** Called after a RELEASE decision. Wired to the payout service; absent in pure-pipeline tests. */
  release?: (submissionId: number) => Promise<unknown>;
  /** Injectable clock for covenant expiry (defaults to now). */
  today?: Date;
};

export async function processSubmission(
  deps: PipelineDeps,
  input: { ngoId: number; trancheId: number; receipt: StoredFile; roster?: StoredFile; evidence?: StoredFile[]; memoText?: string },
): Promise<SubmissionResult> {
  const { db, llm } = deps;
  const tranche = db.prepare("SELECT * FROM tranche WHERE id=?").get(input.trancheId) as TrancheRow | undefined;
  if (!tranche) throw new PipelineError("Tranche not found", 404);
  const grant = db.prepare("SELECT * FROM grant_award WHERE id=?").get(tranche.grant_id) as GrantRow;
  if (grant.ngo_id !== input.ngoId) throw new PipelineError("This tranche belongs to a different NGO.", 403);
  // State machine: evidence may only be submitted while waiting for it (or after a hold, to resubmit).
  if (!["PENDING_EVIDENCE", "HELD"].includes(tranche.status))
    throw new PipelineError(`Tranche ${tranche.seq} is ${tranche.status} and cannot accept new evidence.`, 409);
  const reqs = JSON.parse(tranche.requirements) as Requirements;
  // Proof of work is the grantee's choice (attendance list, project photos, a report...). Any supporting file satisfies intake;
  // WHETHER it proves enough is decided later by the attendee check, which sends uncountable proof to a person, never to auto-release.
  const supporting = [...(input.roster ? [input.roster] : []), ...(input.evidence ?? [])];
  if (supporting.length > 5) throw new PipelineError("Please send at most 5 supporting files.");
  if (reqs.required_attendees > 0 && supporting.length === 0) throw new PipelineError("Add at least one proof of work (an attendance list, project photos or a report).");

  const memoText = input.memoText?.slice(0, 4000) ?? null;
  const submissionId = Number(
    db
      .prepare("INSERT INTO submission (tranche_id, ngo_id, file_paths, file_hashes, memo_text) VALUES (?,?,?,?,?)")
      .run(
        tranche.id, input.ngoId,
        JSON.stringify({ receipt: input.receipt.path, supporting: supporting.map((f) => f.path) }),
        JSON.stringify({ receipt: input.receipt.sha256, supporting: supporting.map((f) => f.sha256) }),
        memoText,
      ).lastInsertRowid,
  );
  const L = (eventType: string, payload: unknown, status?: string) =>
    writeLedger(db, { ngoId: grant.ngo_id, grantId: grant.id, trancheId: tranche.id, submissionId, eventType, actor: "SYSTEM", payload, status });
  L("SUBMISSION_RECEIVED", { files: ["receipt", ...supporting.map(() => "supporting")], has_memo: !!memoText, receipt_sha256: input.receipt.sha256 }, "RECEIVED");

  // GATE 1: compliance covenants. Deterministic, reads only the grantee vault, runs BEFORE any model call.
  // A failing payout-blocking covenant stops the submission here: HOLD, nothing is extracted, nothing can be paid.
  const today = deps.today ?? new Date();
  const vault = parseVault((db.prepare("SELECT compliance_vault FROM ngo WHERE id=?").get(grant.ngo_id) as { compliance_vault: string }).compliance_vault);
  const covenants = parseCovenants(grant.covenants);
  const gate = evaluateComplianceCovenants(covenants, vault, today);
  if (covenants.length > 0) {
    L(
      gate.passed ? "STATUTORY_COMPLIANCE_VERIFIED" : "STATUTORY_COMPLIANCE_FAILED",
      { ...compliancePayload(gate, toISODate(today)), blocking: gate.blockingFailures.length > 0 },
      gate.passed ? "VERIFIED" : "FAILED",
    );
  }
  if (gate.blockingFailures.length > 0) {
    const reasons = gate.blockingFailures.map((r) => r.check.detail);
    const ex = await generateAuditExplanation(llm, { decision: "HOLD", checks: gate.checks, extraction: { status: "SKIPPED", codes: [] } });
    // Deterministic remediation: names exactly what to add or renew (funder-defined names only).
    const remediation = `Open the Compliance Vault and add or renew: ${gate.blockingFailures.map((r) => r.covenant.name).join("; ")}. Then resubmit your evidence.`;
    db.transaction(() => {
      db.prepare("UPDATE submission SET check_results=?, decision='HOLD', decision_reason=?, llm_explanation=?, remediation_note=? WHERE id=?")
        .run(JSON.stringify(gate.checks), reasons.join("\n"), ex.explanation, remediation, submissionId);
      if (tranche.status !== "HELD") db.prepare("UPDATE tranche SET status='HELD' WHERE id=?").run(tranche.id);
      L("DECISION_MADE", { decision: "HOLD", reasons, gate: "STATUTORY_COMPLIANCE", extraction_skipped: true, explanation_source: ex.source, fallback_reason: ex.fallbackReason ?? null }, "HOLD");
    })();
    return { submissionId, decision: "HOLD", reasons, checks: gate.checks, explanation: ex.explanation, remediationNote: remediation, trancheStatus: "HELD" };
  }

  // Two independent extraction runs: disagreement between them is the main unreliability signal.
  const files: LlmFile[] = [input.receipt, ...supporting].map((f, i) => ({
    name: i === 0 ? "receipt" : `supporting_${i}`,
    mediaType: f.mediaType,
    base64: fs.readFileSync(f.path).toString("base64"),
  }));
  const runs = await extractDualPass(llm, files, memoText ?? undefined);
  const reliability = assessReliability(runs, memoText);
  const final = runs[0].norm ?? runs[1].norm ?? EMPTY;
  const dump = (r: RunOutcome) => JSON.stringify(r.raw ? { ok: true, data: r.raw, problems: r.problems } : { ok: false, error: r.failed });
  L("EXTRACTION_DONE", { reliable: reliability.reliable, reasons: reliability.reasons }, reliability.reliable ? "RELIABLE" : "UNRELIABLE");

  // Covenant checks join the list so every requirement shows on the decision screen (non-blocking failures are SOFT: officer review).
  const checks = [...runAllChecks(loadContext(db, submissionId, tranche, grant, final, input.receipt.sha256)), ...gate.checks];
  const { decision, reasons } = decide(checks, reliability);

  // Explanation comes AFTER the decision and sees only structured check results (never document text).
  const ex = await generateAuditExplanation(llm, { decision, checks, extraction: { status: reliability.reliable ? "RELIABLE" : "UNRELIABLE", codes: reliability.codes ?? [] } });

  const trancheStatus = decision === "HOLD" ? "HELD" : decision === "OFFICER_REVIEW" ? "IN_REVIEW" : tranche.status;
  db.transaction(() => {
    db.prepare(
      `UPDATE submission SET extracted_run1=?, extracted_run2=?, extracted_final=?, check_results=?, decision=?, decision_reason=?, llm_explanation=?, remediation_note=? WHERE id=?`,
    ).run(dump(runs[0]), dump(runs[1]), JSON.stringify({ normalized: final, reliability }), JSON.stringify(checks), decision, reasons.join("\n"), ex.explanation, ex.remediation_note, submissionId);
    if (trancheStatus !== tranche.status) db.prepare("UPDATE tranche SET status=? WHERE id=?").run(trancheStatus, tranche.id);
    L("DECISION_MADE", { decision, reasons, explanation_source: ex.source, fallback_reason: ex.fallbackReason ?? null }, decision);
  })();

  if (decision === "RELEASE" && deps.release) await deps.release(submissionId).catch(() => undefined); // failures are ledgered by the payout service
  const finalStatus = (db.prepare("SELECT status FROM tranche WHERE id=?").get(tranche.id) as { status: string }).status;
  return { submissionId, decision, reasons, checks, explanation: ex.explanation, remediationNote: ex.remediation_note, trancheStatus: finalStatus };
}
