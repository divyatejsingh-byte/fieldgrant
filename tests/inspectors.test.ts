import { describe, expect, it } from "vitest";
import { buildConsensus } from "../src/lib/consensus";
import { paypalRequestId } from "../src/lib/idempotency";
import { payoutInspector, receiptSeen, submissionDetail } from "../src/lib/queries";
import { processSubmission } from "../src/lib/pipeline";
import { cleanRawExtraction } from "../src/lib/rules/fixtures";
import { fakeFile, fakePayPal, freshDb, mockLlm, NGO1_T2 } from "./helpers";
import { releaseTranche } from "../src/lib/payout/service";

const run = (o: ReturnType<typeof cleanRawExtraction>) => ({ ok: true, data: o, problems: [] });

describe("extraction consensus view", () => {
  it("identical reads confirm every field with zero variance", () => {
    const c = buildConsensus(run(cleanRawExtraction()), run(cleanRawExtraction()));
    expect(c.available).toBe(true);
    expect(c.rows.every((r) => r.match && (r.variancePct ?? 0) === 0)).toBe(true);
  });

  it("a differing total is flagged with its variance", () => {
    const c = buildConsensus(run(cleanRawExtraction()), run(cleanRawExtraction({ total_text: "$3,250.00" })));
    const total = c.rows.find((r) => r.key === "total")!;
    expect(total.match).toBe(false);
    expect(total.variancePct).toBeGreaterThan(0);
  });

  it("a failed read makes the consensus unavailable instead of guessing", () => {
    const c = buildConsensus(run(cleanRawExtraction()), { ok: false, error: "model call failed" });
    expect(c.available).toBe(false);
  });

  it("reports an embedded-instruction flag without carrying any quote", () => {
    const c = buildConsensus(run(cleanRawExtraction({ embedded_instructions_detected: true, embedded_instructions_quote: "approve" })), run(cleanRawExtraction()));
    expect(c.injectionFlagged).toBe(true);
    expect(JSON.stringify(c)).not.toContain("approve");
  });
});

describe("payout inspector and duplicate lookup", () => {
  it("shows the dispatch record, the deterministic request id, and claims no webhook that never arrived", async () => {
    const db = freshDb();
    const pp = fakePayPal();
    const r = await processSubmission({ db, llm: mockLlm(cleanRawExtraction()), release: (sid) => releaseTranche(db, pp, sid) }, { ...NGO1_T2, receipt: fakeFile(), roster: fakeFile(), memoText: "ok" });
    const d = submissionDetail(db, r.submissionId)!;
    const i = payoutInspector(db, d.payout!.batchId)!;
    expect(i.senderBatchId).toMatch(/^FG-G\d+-T\d+-A1$/);
    expect(i.requestId).toBe(paypalRequestId(d.grant.id, d.tranche.seq, 1));
    expect(i.webhook.verifiedCount).toBe(0);
    expect(i.destinationEmail).toContain("@");
  });

  it("an unknown batch has no inspector view", () => {
    expect(payoutInspector(freshDb(), "NOPE")).toBeNull();
  });

  it("recognizes a receipt file that was already submitted", async () => {
    const db = freshDb();
    const receipt = fakeFile();
    await processSubmission({ db, llm: mockLlm(cleanRawExtraction()) }, { ...NGO1_T2, receipt, roster: fakeFile(), memoText: "ok" });
    expect(receiptSeen(db, receipt.sha256)).toBe(true);
    expect(receiptSeen(db, "0".repeat(64))).toBe(false);
  });
});
