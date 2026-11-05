import type Database from "better-sqlite3";
import { buildConsensus } from "./consensus";
import { requestIdForBatch } from "./idempotency";
import { isFYModel } from "./fiscal-year";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const parse = (s: string | null) => (s ? JSON.parse(s) : null);

export function listNgos(db: Database.Database) {
  return db.prepare("SELECT id, name, sector, country_label, country_code, contact_name FROM ngo ORDER BY id").all() as Row[];
}

/** `foundationId` limits the view to one funder's grants (a grantmaker never sees another funder's grants to the same NGO). */
export function ngoDetail(db: Database.Database, ngoId: number, foundationId?: number) {
  const ngo = db.prepare("SELECT id, name, sector, country_label, country_code, contact_name FROM ngo WHERE id=?").get(ngoId) as Row | undefined;
  if (!ngo) return null;
  const grants = (db.prepare(`SELECT * FROM grant_award WHERE ngo_id=? ${foundationId ? "AND foundation_id=?" : ""} ORDER BY id`).all(...(foundationId ? [ngoId, foundationId] : [ngoId])) as Row[]).map((g) => ({
    ...g,
    tranches: (db.prepare("SELECT * FROM tranche WHERE grant_id=? ORDER BY seq").all(g.id) as Row[]).map((t) => {
      const sub = db.prepare("SELECT id, decision FROM submission WHERE tranche_id=? ORDER BY id DESC LIMIT 1").get(t.id) as Row | undefined;
      return { ...t, requirements: JSON.parse(t.requirements), latestSubmissionId: sub?.id ?? null, latestDecision: sub?.decision ?? null };
    }),
  }));
  return { ngo, grants: grants as (Row & { tranches: Row[] })[] };
}

/** Tranches an NGO may submit evidence for. */
export function submittableTranches(db: Database.Database, ngoId: number) {
  return db
    .prepare(
      `SELECT t.id, t.grant_id, t.seq, t.amount_cents, t.status, t.requirements, g.name AS grant_name, g.foundation_name AS funder_name, g.spend_cap_cents AS cap_cents,
         (SELECT COALESCE(SUM(t2.amount_cents),0) FROM tranche t2 WHERE t2.grant_id=g.id AND t2.id<>t.id AND t2.status IN ('PAID','RELEASING')) AS committed_cents
       FROM tranche t JOIN grant_award g ON g.id=t.grant_id
       WHERE g.ngo_id=? AND t.status IN ('PENDING_EVIDENCE','HELD') ORDER BY g.id, t.seq`,
    )
    .all(ngoId)
    .map((t) => ({ ...(t as Row), requirements: JSON.parse((t as Row).requirements) }));
}

function fyModelOf(db: Database.Database, foundationId: number | null) {
  const m = (db.prepare("SELECT fy_model FROM foundation WHERE id=?").get(foundationId) as { fy_model?: string } | undefined)?.fy_model;
  return isFYModel(m) ? m : "CALENDAR";
}

export function submissionDetail(db: Database.Database, id: number) {
  const s = db.prepare("SELECT * FROM submission WHERE id=?").get(id) as Row | undefined;
  if (!s) return null;
  const tranche = db.prepare("SELECT * FROM tranche WHERE id=?").get(s.tranche_id) as Row;
  const grant = db.prepare("SELECT * FROM grant_award WHERE id=?").get(tranche.grant_id) as Row;
  const ngo = db.prepare("SELECT id, name, paypal_email, country_code FROM ngo WHERE id=?").get(s.ngo_id) as Row;
  const fin = parse(s.extracted_final);
  const payout = db
    .prepare("SELECT payout_batch_id, payout_item_id, status, event_type, created_at FROM ledger_entry WHERE submission_id=? AND payout_batch_id IS NOT NULL ORDER BY id DESC")
    .all(id) as Row[];
  const latest = payout[0];
  const itemId = payout.find((p) => p.payout_item_id)?.payout_item_id ?? null;
  return {
    id: s.id,
    createdAt: s.created_at,
    ngo: { id: ngo.id, name: ngo.name, countryCode: ngo.country_code },
    funder: { id: grant.foundation_id, name: grant.foundation_name },
    funderFyModel: fyModelOf(db, grant.foundation_id),
    grant: { id: grant.id, name: grant.name, start_date: grant.start_date, end_date: grant.end_date },
    tranche: { id: tranche.id, seq: tranche.seq, amount_cents: tranche.amount_cents, status: tranche.status, requirements: JSON.parse(tranche.requirements) },
    memo: s.memo_text,
    // True when Gate 1 (compliance) stopped the submission before any document was read.
    extractionSkipped: !s.extracted_final && !!s.decision,
    covenants: JSON.parse(grant.covenants || "[]"),
    extracted: fin?.normalized ?? null,
    reliability: fin?.reliability ?? null,
    runs: [parse(s.extracted_run1), parse(s.extracted_run2)].map((r) => (r ? { ok: r.ok, error: r.error ?? null } : null)),
    consensus: buildConsensus(parse(s.extracted_run1), parse(s.extracted_run2)),
    checks: parse(s.check_results) ?? [],
    decision: s.decision,
    decisionReason: s.decision_reason,
    explanation: s.llm_explanation,
    remediation: s.remediation_note,
    payout: latest ? { batchId: latest.payout_batch_id, itemId, status: latest.status } : null,
    ledger: db.prepare("SELECT id, event_type, actor, status, created_at, payload FROM ledger_entry WHERE submission_id=? ORDER BY id").all(id).map((r) => ({ ...(r as Row), payload: parse((r as Row).payload) })),
  };
}

export function reviewQueue(db: Database.Database, foundationId?: number) {
  return db
    .prepare(
      `SELECT s.id, s.decision, s.decision_reason, s.created_at, n.name AS ngo_name, g.name AS grant_name, t.seq, t.amount_cents, t.status AS tranche_status, s.llm_explanation
       FROM submission s JOIN tranche t ON t.id=s.tranche_id JOIN grant_award g ON g.id=t.grant_id JOIN ngo n ON n.id=g.ngo_id
       WHERE t.status IN ('IN_REVIEW','HELD') AND s.id = (SELECT MAX(id) FROM submission WHERE tranche_id=t.id)
       ${foundationId ? "AND g.foundation_id=?" : ""}
       ORDER BY (t.status='IN_REVIEW') DESC, s.id DESC`,
    )
    .all(...(foundationId ? [foundationId] : []));
}

export function ledgerRows(db: Database.Database, f: { ngoId?: number; foundationId?: number } = {}) {
  const where: string[] = [];
  const args: number[] = [];
  if (f.ngoId) { where.push("l.ngo_id=?"); args.push(f.ngoId); }
  if (f.foundationId) { where.push("g.foundation_id=?"); args.push(f.foundationId); }
  const rows = db
    .prepare(
      `SELECT l.id, l.created_at, n.name AS ngo, g.name AS grant_name, t.seq AS tranche, l.event_type, l.actor, l.status, l.payout_batch_id, l.payout_item_id, l.is_seeded, l.ngo_id, l.submission_id, l.payload, s.decision AS band, t.amount_cents, t.status AS tranche_status
       FROM ledger_entry l LEFT JOIN submission s ON s.id=l.submission_id JOIN ngo n ON n.id=l.ngo_id JOIN grant_award g ON g.id=l.grant_id JOIN tranche t ON t.id=l.tranche_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY l.id DESC`,
    )
    .all(...args);
  return rows;
}

/**
 * Everything the "PayPal Rail Inspector" shows for one payout batch. Every field is read from our own records:
 * the dispatch ledger entry (sender_batch_id, attempt), the recipient on file and the status history. The PayPal-Request-Id is the
 * deterministic value we send for that attempt. "Webhook verified" is only claimed when a ledger row written by the webhook
 * handler exists, because that handler runs only after the signature check passed.
 */
export function payoutInspector(db: Database.Database, batchId: string) {
  const created = db.prepare("SELECT * FROM ledger_entry WHERE payout_batch_id=? AND event_type='PAYOUT_CREATED' ORDER BY id LIMIT 1").get(batchId) as Row | undefined;
  if (!created) return null;
  const tranche = db.prepare("SELECT * FROM tranche WHERE id=?").get(created.tranche_id) as Row;
  const grant = db.prepare("SELECT id, name FROM grant_award WHERE id=?").get(created.grant_id) as Row;
  const ngo = db.prepare("SELECT name, paypal_email FROM ngo WHERE id=?").get(created.ngo_id) as Row;
  const payload = parse(created.payload) ?? {};
  const attempt = Number(payload.attempt ?? 1);
  const events = (db.prepare("SELECT id, event_type, actor, status, payout_item_id, payload, created_at FROM ledger_entry WHERE payout_batch_id=? ORDER BY id").all(batchId) as Row[]).map((e) => ({
    id: e.id, eventType: e.event_type, actor: e.actor, status: e.status, itemId: e.payout_item_id, at: e.created_at, webhookType: (parse(e.payload) ?? {}).webhook_event_type ?? null,
  }));
  const hooks = events.filter((e) => e.actor === "WEBHOOK");
  const last = [...events].reverse().find((e) => e.eventType === "PAYOUT_STATUS_UPDATE") ?? events[events.length - 1];
  return {
    batchId, submissionId: created.submission_id as number | null,
    itemId: events.find((e) => e.itemId)?.itemId ?? null,
    status: (last?.status as string | null) ?? null,
    destinationEmail: ngo.paypal_email as string, ngoName: ngo.name as string,
    amountCents: tranche.amount_cents as number, grantName: grant.name as string, trancheSeq: tranche.seq as number,
    senderBatchId: (payload.sender_batch_id as string | undefined) ?? batchId, attempt,
    requestId: requestIdForBatch((payload.sender_batch_id as string | undefined) ?? batchId),
    dispatchedAt: created.created_at as string,
    webhook: { verifiedCount: hooks.length, lastType: hooks[hooks.length - 1]?.webhookType ?? null, lastAt: hooks[hooks.length - 1]?.at ?? null },
    events,
  };
}

/** True when this exact file (by SHA-256) was already used in any submission, by any organization. */
export function receiptSeen(db: Database.Database, sha256: string): boolean {
  return !!db.prepare("SELECT 1 FROM submission WHERE json_extract(file_hashes, '$.receipt')=? LIMIT 1").get(sha256);
}
