// Payout service: tranche state machine + idempotent PayPal release + status application + polling + officer override.
import type Database from "better-sqlite3";
import { payoutEpoch, paypalRequestId, senderBatchId } from "../idempotency";
import { writeLedger } from "../ledger";
import { formatUsd } from "../money";
import {
  createPayout, getPayoutBatch, paypalConfigured, PayPalError,
  type BatchDetails, type CreatePayoutInput, type PayoutBatchResult,
} from "../paypal/client";

/** Injected so tests can use a clearly-labelled test double. Production uses `livePayPal`. */
export interface PayPalApi {
  configured(): boolean;
  createPayout(i: CreatePayoutInput): Promise<PayoutBatchResult>;
  getPayoutBatch(id: string): Promise<BatchDetails>;
}
export const livePayPal: PayPalApi = { configured: paypalConfigured, createPayout, getPayoutBatch };

export class PayoutError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message);
  }
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DEFINITIVE_FAIL = new Set(["FAILED", "BLOCKED", "RETURNED", "REFUNDED", "REVERSED", "DENIED", "CANCELED"]);
const RELEASABLE = ["PENDING_EVIDENCE", "IN_REVIEW", "HELD"];

function ctx(db: Database.Database, submissionId: number) {
  const sub = db.prepare("SELECT * FROM submission WHERE id=?").get(submissionId) as Row | undefined;
  if (!sub) throw new PayoutError("Submission not found", 404);
  const tranche = db.prepare("SELECT * FROM tranche WHERE id=?").get(sub.tranche_id) as Row;
  const grant = db.prepare("SELECT * FROM grant_award WHERE id=?").get(tranche.grant_id) as Row;
  const ngo = db.prepare("SELECT * FROM ngo WHERE id=?").get(grant.ngo_id) as Row;
  return { sub, tranche, grant, ngo };
}

/**
 * Release a tranche. SAFETY (idempotency):
 *  1. Only a RELEASE decision can be paid.
 *  2. The tranche is claimed (-> RELEASING) in ONE synchronous SQLite transaction BEFORE the network call, so a
 *     double click or concurrent request sees RELEASING/PAID and is rejected. It can never pay twice.
 *  3. sender_batch_id and PayPal-Request-Id are deterministic per (grant, tranche, attempt). A retry after an
 *     ambiguous failure (e.g. network timeout) reuses the SAME keys so PayPal can dedupe; a new attempt number is
 *     only used after PayPal definitively rejected the previous one.
 *  4. The spend cap is re-checked here, in code, regardless of what any earlier decision said.
 */
export async function releaseTranche(db: Database.Database, pp: PayPalApi, submissionId: number): Promise<{ payoutBatchId: string; batchStatus: string }> {
  const { sub, tranche, grant, ngo } = ctx(db, submissionId);
  const L = (e: Omit<Parameters<typeof writeLedger>[1], "ngoId" | "grantId" | "trancheId" | "submissionId">) =>
    writeLedger(db, { ngoId: ngo.id, grantId: grant.id, trancheId: tranche.id, submissionId, ...e });
  const fail = (message: string, kind: string, definitive: boolean, status = 422): never => {
    L({ eventType: "PAYOUT_FAILED", actor: "SYSTEM", payload: { message, kind, definitive }, status: "FAILED" });
    throw new PayoutError(message, status);
  };

  if (sub.decision !== "RELEASE") throw new PayoutError("Only a submission with a RELEASE decision can be paid.");
  if (["RELEASING", "PAID"].includes(tranche.status)) throw new PayoutError(`Tranche is already ${tranche.status}; it cannot be paid again.`);
  if (!pp.configured()) return fail("PayPal sandbox credentials are not configured (see .env.example). The decision is saved; retry the payout once they are set.", "NOT_CONFIGURED", false, 503);
  if (!ngo.paypal_email || ngo.paypal_email.endsWith(".invalid")) return fail("This NGO has no sandbox PayPal recipient email configured (NGOn_PAYPAL_EMAIL).", "NO_RECIPIENT", false);

  const prevStatus = tranche.status as string;
  let attempt = 0;
  let capError: string | null = null;
  db.transaction(() => {
    const cur = (db.prepare("SELECT status, amount_cents FROM tranche WHERE id=?").get(tranche.id) as Row);
    if (["RELEASING", "PAID"].includes(cur.status)) throw new PayoutError(`Tranche is already ${cur.status}; it cannot be paid again.`);
    if (!RELEASABLE.includes(cur.status)) throw new PayoutError(`Tranche is ${cur.status} and cannot be paid yet.`);
    const committed = (db.prepare("SELECT COALESCE(SUM(amount_cents),0) c FROM tranche WHERE grant_id=? AND id<>? AND status IN ('PAID','RELEASING')").get(grant.id, tranche.id) as Row).c;
    if (committed + cur.amount_cents > grant.spend_cap_cents) {
      capError = `Spend cap exceeded: ${formatUsd(committed)} already committed + ${formatUsd(cur.amount_cents)} would exceed the ${formatUsd(grant.spend_cap_cents)} cap.`;
      return;
    }
    const failures = (db.prepare("SELECT COUNT(*) c FROM ledger_entry WHERE tranche_id=? AND event_type='PAYOUT_FAILED' AND json_extract(payload,'$.definitive')=1").get(tranche.id) as Row).c;
    attempt = failures + 1;
    db.prepare("UPDATE tranche SET status='RELEASING' WHERE id=?").run(tranche.id);
  })();
  if (capError) return fail(capError, "SPEND_CAP", false);

  const epoch = payoutEpoch(db);
  const batchId = senderBatchId(grant.id, tranche.seq, attempt, epoch);
  try {
    const res = await pp.createPayout({
      senderBatchId: batchId,
      requestId: paypalRequestId(grant.id, tranche.seq, attempt, epoch),
      receiverEmail: ngo.paypal_email,
      amountCents: tranche.amount_cents,
      senderItemId: `${batchId}-I1`,
      note: `FieldGrant sandbox tranche ${tranche.seq}`,
    });
    L({ eventType: "PAYOUT_CREATED", actor: "SYSTEM", payload: { sender_batch_id: batchId, attempt, amount: formatUsd(tranche.amount_cents) }, payoutBatchId: res.payoutBatchId, status: res.batchStatus });
    // Disbursed capital is attributed to a fiscal year by this dispatch date.
    db.prepare("UPDATE tranche SET disbursed_at=datetime('now') WHERE id=?").run(tranche.id);
    await refreshBatch(db, pp, res.payoutBatchId, "SYSTEM").catch(() => undefined); // best effort: learns the item id
    startPolling(db, pp, res.payoutBatchId);
    return res;
  } catch (e) {
    const pe = e instanceof PayPalError ? e : new PayPalError((e as Error).message, "OTHER");
    // AUTH / VALIDATION / INSUFFICIENT_FUNDS are definitive rejections (nothing was created). NETWORK/OTHER are
    // ambiguous, so the attempt number is NOT bumped and the retry reuses the same idempotency keys.
    const definitive = ["AUTH", "VALIDATION", "INSUFFICIENT_FUNDS"].includes(pe.kind);
    db.prepare("UPDATE tranche SET status=? WHERE id=? AND status='RELEASING'").run(prevStatus, tranche.id);
    L({ eventType: "PAYOUT_FAILED", actor: "SYSTEM", payload: { message: pe.message, kind: pe.kind, code: pe.code ?? null, definitive, attempt }, status: "FAILED" });
    throw new PayoutError(pe.message, 502);
  }
}

/** Applies PayPal item/batch status to the ledger and tranche. Safe to call repeatedly (de-duplicated). */
export function applyBatchDetails(db: Database.Database, batchId: string, d: BatchDetails, actor: "SYSTEM" | "WEBHOOK", extra: Record<string, unknown> = {}): void {
  const created = db.prepare("SELECT * FROM ledger_entry WHERE payout_batch_id=? AND event_type='PAYOUT_CREATED' LIMIT 1").get(batchId) as Row | undefined;
  if (!created) return; // not a payout we created
  const entries = d.items.length ? d.items.map((i) => ({ itemId: i.payoutItemId, status: i.transactionStatus, errors: i.errors })) : [{ itemId: null, status: d.batchStatus, errors: undefined }];
  for (const it of entries) {
    const last = db.prepare("SELECT status FROM ledger_entry WHERE payout_batch_id=? AND event_type='PAYOUT_STATUS_UPDATE' ORDER BY id DESC LIMIT 1").get(batchId) as Row | undefined;
    if (last?.status === it.status && !extra.webhook_event_id) continue; // nothing new
    const base = { ngoId: created.ngo_id, grantId: created.grant_id, trancheId: created.tranche_id, submissionId: created.submission_id, actor, payoutBatchId: batchId, payoutItemId: it.itemId };
    writeLedger(db, { ...base, eventType: "PAYOUT_STATUS_UPDATE", payload: { batch_status: d.batchStatus, errors: it.errors ?? null, ...extra }, status: it.status });
    const tr = db.prepare("SELECT status FROM tranche WHERE id=?").get(created.tranche_id) as Row;
    if (it.status === "SUCCESS" && tr.status === "RELEASING") db.prepare("UPDATE tranche SET status='PAID' WHERE id=?").run(created.tranche_id);
    else if (DEFINITIVE_FAIL.has(it.status) && tr.status === "RELEASING") {
      // The money did not (or no longer) reach the recipient. Re-open the tranche; a retry uses a NEW attempt number.
      db.prepare("UPDATE tranche SET status='HELD', disbursed_at=NULL WHERE id=?").run(created.tranche_id);
      writeLedger(db, { ...base, eventType: "PAYOUT_FAILED", payload: { message: `PayPal reported ${it.status}. The tranche was returned to HELD.`, kind: "PAYPAL_STATUS", definitive: true }, status: "FAILED" });
    }
  }
}

export async function refreshBatch(db: Database.Database, pp: PayPalApi, batchId: string, actor: "SYSTEM" | "WEBHOOK" = "SYSTEM"): Promise<BatchDetails> {
  const d = await pp.getPayoutBatch(batchId);
  applyBatchDetails(db, batchId, d, actor);
  return d;
}

// --- bounded polling fallback (webhooks may lag or be unreachable locally) ---
const polling = new Set<string>();
export function startPolling(db: Database.Database, pp: PayPalApi, batchId: string, opts = { intervalMs: 10_000, maxPolls: 60 }): void {
  if (polling.has(batchId)) return;
  polling.add(batchId);
  let n = 0;
  const tick = async () => {
    n++;
    try {
      await refreshBatch(db, pp, batchId);
    } catch { /* transient: keep polling until the bound */ }
    const created = db.prepare("SELECT tranche_id FROM ledger_entry WHERE payout_batch_id=? AND event_type='PAYOUT_CREATED'").get(batchId) as Row | undefined;
    const st = created ? (db.prepare("SELECT status FROM tranche WHERE id=?").get(created.tranche_id) as Row | undefined)?.status : null;
    if (n >= opts.maxPolls || st !== "RELEASING") { polling.delete(batchId); return; }
    setTimeout(tick, opts.intervalMs).unref?.();
  };
  setTimeout(tick, opts.intervalMs).unref?.();
}

/** Officer approve / hold / override. Logs who, when, reason and the previous decision. Cannot touch RELEASING/PAID. */
export async function overrideDecision(
  db: Database.Database, pp: PayPalApi,
  i: { submissionId: number; newDecision: "RELEASE" | "HOLD"; reason: string; officer?: string },
): Promise<{ previousDecision: string; newDecision: string; payout?: { payoutBatchId: string; batchStatus: string }; payoutError?: string }> {
  const reason = i.reason?.trim() ?? "";
  if (reason.length < 5) throw new PayoutError("A reason (at least 5 characters) is required.", 400);
  const { sub, tranche, grant, ngo } = ctx(db, i.submissionId);
  if (["RELEASING", "PAID"].includes(tranche.status)) throw new PayoutError(`Tranche is ${tranche.status}; the decision can no longer be changed.`);
  const officer = i.officer ?? "Program Officer (demo)";
  const previous = sub.decision as string;
  db.transaction(() => {
    db.prepare("UPDATE submission SET decision=?, decision_reason=? WHERE id=?").run(i.newDecision, `${sub.decision_reason ?? ""}\nOfficer override (${officer}): ${reason}`.trim(), sub.id);
    if (i.newDecision === "HOLD") db.prepare("UPDATE tranche SET status='HELD' WHERE id=?").run(tranche.id);
    else if (tranche.status === "HELD") db.prepare("UPDATE tranche SET status='IN_REVIEW' WHERE id=?").run(tranche.id);
    writeLedger(db, {
      ngoId: ngo.id, grantId: grant.id, trancheId: tranche.id, submissionId: sub.id, eventType: "OFFICER_OVERRIDE", actor: "OFFICER",
      payload: { who: officer, at: new Date().toISOString(), reason, previous_decision: previous, new_decision: i.newDecision }, status: i.newDecision,
    });
  })();
  if (i.newDecision !== "RELEASE") return { previousDecision: previous, newDecision: i.newDecision };
  try {
    return { previousDecision: previous, newDecision: i.newDecision, payout: await releaseTranche(db, pp, sub.id) };
  } catch (e) {
    return { previousDecision: previous, newDecision: i.newDecision, payoutError: (e as Error).message };
  }
}
