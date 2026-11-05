import { afterEach, describe, expect, it } from "vitest";
import { payoutEpoch, paypalRequestId, senderBatchId } from "../src/lib/idempotency";
import { applyBatchDetails, overrideDecision, PayoutError, releaseTranche } from "../src/lib/payout/service";
import { handlePayPalWebhook } from "../src/lib/payout/webhook-handler";
import { PayPalError } from "../src/lib/paypal/client";
import { verifyPayPalWebhook } from "../src/lib/paypal/webhook";
import { processSubmission } from "../src/lib/pipeline";
import { cleanRawExtraction } from "../src/lib/rules/fixtures";
import { fakeFile, fakePayPal, freshDb, mockLlm, NGO1_T2 } from "./helpers";

/** Runs the pipeline to a RELEASE decision WITHOUT auto-paying, so each test controls the payout. */
async function releaseReady() {
  const db = freshDb();
  const r = await processSubmission({ db, llm: mockLlm(cleanRawExtraction()) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile(), memoText: "ok" });
  expect(r.decision).toBe("RELEASE");
  return { db, sid: r.submissionId };
}
const status = (db: ReturnType<typeof freshDb>) => (db.prepare("SELECT status FROM tranche WHERE id=2").get() as { status: string }).status;
const ledger = (db: ReturnType<typeof freshDb>, type: string) => db.prepare("SELECT * FROM ledger_entry WHERE event_type=? AND is_seeded=0").all(type) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("idempotent release", () => {
  it("creates one payout, records the batch id, tranche -> RELEASING", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal();
    const res = await releaseTranche(db, pp, sid);
    expect(res.payoutBatchId).toBe("BATCH-TEST-1");
    expect(status(db)).toBe("RELEASING");
    expect(pp.calls).toHaveLength(1);
    expect(pp.calls[0]).toMatchObject({ senderBatchId: senderBatchId(1, 2, 1, payoutEpoch(db)), requestId: paypalRequestId(1, 2, 1, payoutEpoch(db)), amountCents: 500_000 });
    expect(ledger(db, "PAYOUT_CREATED")[0].payout_batch_id).toBe("BATCH-TEST-1");
  });

  it("a double click / concurrent calls can never pay twice", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal();
    const results = await Promise.allSettled([releaseTranche(db, pp, sid), releaseTranche(db, pp, sid), releaseTranche(db, pp, sid)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(pp.calls).toHaveLength(1);
  });

  it("a tranche in RELEASING cannot be paid again", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal();
    await releaseTranche(db, pp, sid);
    await expect(releaseTranche(db, pp, sid)).rejects.toThrow(/RELEASING/);
    expect(pp.calls).toHaveLength(1);
  });

  it("a PAID tranche cannot be paid again", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal();
    await releaseTranche(db, pp, sid);
    applyBatchDetails(db, "BATCH-TEST-1", { batchStatus: "SUCCESS", items: [{ payoutItemId: "ITEM-TEST-1", transactionStatus: "SUCCESS" }] }, "SYSTEM");
    expect(status(db)).toBe("PAID");
    await expect(releaseTranche(db, pp, sid)).rejects.toThrow(/PAID/);
    expect(pp.calls).toHaveLength(1);
  });

  it("only RELEASE decisions can be paid", async () => {
    const db = freshDb();
    const r = await processSubmission({ db, llm: mockLlm(new Error("down")) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile() });
    expect(r.decision).toBe("OFFICER_REVIEW");
    const pp = fakePayPal();
    await expect(releaseTranche(db, pp, r.submissionId)).rejects.toThrow(/RELEASE/);
    expect(pp.calls).toHaveLength(0);
  });
});

describe("failure handling", () => {
  it("INSUFFICIENT_FUNDS: human message, PAYOUT_FAILED ledger row, tranche reopened, retry uses a NEW attempt", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal({ createError: new PayPalError("The sandbox sender account has insufficient funds. Add sandbox balance and retry.", "INSUFFICIENT_FUNDS", "INSUFFICIENT_FUNDS", 422) });
    await expect(releaseTranche(db, pp, sid)).rejects.toThrow(/insufficient funds/i);
    expect(status(db)).toBe("PENDING_EVIDENCE");
    expect(ledger(db, "PAYOUT_FAILED")).toHaveLength(1);
    pp.setFail(null);
    await releaseTranche(db, pp, sid);
    expect(pp.calls[1].senderBatchId).toBe(senderBatchId(1, 2, 2, payoutEpoch(db)));
    expect(pp.calls[1].requestId).not.toBe(pp.calls[0].requestId);
  });

  it("ambiguous network failure: retry REUSES the same idempotency keys", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal({ createError: new PayPalError("Network error talking to PayPal", "NETWORK") });
    await expect(releaseTranche(db, pp, sid)).rejects.toBeInstanceOf(PayoutError);
    pp.setFail(null);
    await releaseTranche(db, pp, sid);
    expect(pp.calls[1].senderBatchId).toBe(pp.calls[0].senderBatchId);
    expect(pp.calls[1].requestId).toBe(pp.calls[0].requestId);
  });

  it("PayPal not configured: clear error, ledgered, nothing sent, tranche unchanged", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal({ configured: false });
    await expect(releaseTranche(db, pp, sid)).rejects.toThrow(/not configured/);
    expect(pp.calls).toHaveLength(0);
    expect(status(db)).toBe("PENDING_EVIDENCE");
    expect(ledger(db, "PAYOUT_FAILED")).toHaveLength(1);
  });

  it("spend cap is enforced in code before any payout call", async () => {
    const { db, sid } = await releaseReady();
    db.prepare("UPDATE grant_award SET spend_cap_cents=600000 WHERE id=1").run(); // 250k paid + 500k > 600k
    const pp = fakePayPal();
    await expect(releaseTranche(db, pp, sid)).rejects.toThrow(/Spend cap/);
    expect(pp.calls).toHaveLength(0);
    expect(status(db)).toBe("PENDING_EVIDENCE");
  });

  it("PayPal reporting an item FAILED re-opens the tranche (HELD) and logs PAYOUT_FAILED", async () => {
    const { db, sid } = await releaseReady();
    await releaseTranche(db, fakePayPal(), sid);
    applyBatchDetails(db, "BATCH-TEST-1", { batchStatus: "SUCCESS", items: [{ payoutItemId: "I", transactionStatus: "FAILED" }] }, "SYSTEM");
    expect(status(db)).toBe("HELD");
    expect(ledger(db, "PAYOUT_FAILED").length).toBeGreaterThan(0);
  });

  it("UNCLAIMED keeps the tranche RELEASING (not paid)", async () => {
    const { db, sid } = await releaseReady();
    await releaseTranche(db, fakePayPal(), sid);
    applyBatchDetails(db, "BATCH-TEST-1", { batchStatus: "SUCCESS", items: [{ payoutItemId: "I", transactionStatus: "UNCLAIMED" }] }, "SYSTEM");
    expect(status(db)).toBe("RELEASING");
  });
});

describe("officer override", () => {
  it("requires a reason", async () => {
    const { db, sid } = await releaseReady();
    await expect(overrideDecision(db, fakePayPal(), { submissionId: sid, newDecision: "HOLD", reason: " " })).rejects.toThrow(/reason/);
  });

  it("logs who, when, reason and the previous decision; HOLD -> tranche HELD", async () => {
    const { db, sid } = await releaseReady();
    await overrideDecision(db, fakePayPal(), { submissionId: sid, newDecision: "HOLD", reason: "Vendor looks unfamiliar" });
    const row = ledger(db, "OFFICER_OVERRIDE")[0];
    const p = JSON.parse(row.payload);
    expect(row.actor).toBe("OFFICER");
    expect(p).toMatchObject({ previous_decision: "RELEASE", new_decision: "HOLD", reason: "Vendor looks unfamiliar" });
    expect(p.who).toBeTruthy();
    expect(p.at).toBeTruthy();
    expect(status(db)).toBe("HELD");
  });

  it("overriding a HOLD to RELEASE pays exactly once", async () => {
    const db = freshDb();
    const over = cleanRawExtraction({ total_text: "$3,250.00", receipt_transcription: "TOTAL $3,250.00" });
    const r = await processSubmission({ db, llm: mockLlm(over) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile() });
    expect(r.decision).toBe("HOLD");
    const pp = fakePayPal();
    const o = await overrideDecision(db, pp, { submissionId: r.submissionId, newDecision: "RELEASE", reason: "Approved variance, signed by director" });
    expect(o.previousDecision).toBe("HOLD");
    expect(o.payout?.payoutBatchId).toBe("BATCH-TEST-1");
    expect(pp.calls).toHaveLength(1);
  });

  it("cannot override once PAID", async () => {
    const { db, sid } = await releaseReady();
    await releaseTranche(db, fakePayPal(), sid);
    applyBatchDetails(db, "BATCH-TEST-1", { batchStatus: "SUCCESS", items: [{ payoutItemId: "I", transactionStatus: "SUCCESS" }] }, "SYSTEM");
    await expect(overrideDecision(db, fakePayPal(), { submissionId: sid, newDecision: "HOLD", reason: "too late now" })).rejects.toThrow(/PAID/);
  });
});

describe("webhooks", () => {
  const body = (id: string, type = "PAYMENT.PAYOUTS-ITEM.SUCCEEDED") =>
    JSON.stringify({ id, event_type: type, resource: { payout_batch_id: "BATCH-TEST-1", payout_item_id: "ITEM-TEST-1", transaction_status: "SUCCESS" } });

  it("an unverifiable signature is rejected and changes nothing", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal();
    await releaseTranche(db, pp, sid);
    const before = db.prepare("SELECT COUNT(*) c FROM ledger_entry").get();
    const res = await handlePayPalWebhook(db, pp, async () => false, new Headers(), body("WH-1"));
    expect(res.status).toBe(401);
    expect(db.prepare("SELECT COUNT(*) c FROM ledger_entry").get()).toEqual(before);
    expect(status(db)).toBe("RELEASING");
  });

  it("a verified SUCCEEDED event marks the tranche PAID; replays are ignored", async () => {
    const { db, sid } = await releaseReady();
    const pp = fakePayPal();
    await releaseTranche(db, pp, sid);
    const ok = async () => true;
    expect((await handlePayPalWebhook(db, pp, ok, new Headers(), body("WH-2"))).status).toBe(200);
    expect(status(db)).toBe("PAID");
    const n = (db.prepare("SELECT COUNT(*) c FROM ledger_entry").get() as { c: number }).c;
    const replay = await handlePayPalWebhook(db, pp, ok, new Headers(), body("WH-2"));
    expect(replay.body.duplicate).toBe(true);
    expect((db.prepare("SELECT COUNT(*) c FROM ledger_entry").get() as { c: number }).c).toBe(n);
  });

  describe("verifyPayPalWebhook fails closed", () => {
    const saved = process.env.PAYPAL_WEBHOOK_ID;
    afterEach(() => { if (saved === undefined) delete process.env.PAYPAL_WEBHOOK_ID; else process.env.PAYPAL_WEBHOOK_ID = saved; });

    it("rejects when no webhook id is configured", async () => {
      delete process.env.PAYPAL_WEBHOOK_ID;
      expect(await verifyPayPalWebhook(new Headers(), "{}")).toBe(false);
    });
    it("rejects when signature headers are missing (no network call made)", async () => {
      process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
      expect(await verifyPayPalWebhook(new Headers({ "paypal-transmission-id": "x" }), "{}")).toBe(false);
    });
    it("rejects a cert_url that is not an https paypal.com host", async () => {
      process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
      const h = new Headers({ "paypal-transmission-id": "1", "paypal-transmission-time": "t", "paypal-transmission-sig": "s", "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://evil.example.com/cert.pem" });
      expect(await verifyPayPalWebhook(h, "{}")).toBe(false);
    });
  });
});

describe("PayPal remembers sender_batch_id for 30 days", () => {
  it("a reseeded demo gets a new epoch, so the same grant, tranche and attempt never reuses an id", async () => {
    const { freshDb } = await import("./helpers");
    const { seedDatabase } = await import("../src/lib/seed");
    const db = freshDb();
    const first = payoutEpoch(db);
    seedDatabase(db, ["a@example.test", "b@example.test", "c@example.test"]);
    const second = payoutEpoch(db);
    expect(first).toMatch(/^[a-f0-9]{8}$/);
    expect(second).not.toBe(first);
    expect(senderBatchId(1, 2, 1, first)).not.toBe(senderBatchId(1, 2, 1, second));
  });
});
