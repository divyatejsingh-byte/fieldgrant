import { describe, expect, it } from "vitest";
import { paypalRequestId, senderBatchId } from "./idempotency";

describe("idempotency keys", () => {
  it("is deterministic for the same (grant, tranche, attempt)", () => {
    expect(senderBatchId(1, 2, 1)).toBe(senderBatchId(1, 2, 1));
    expect(paypalRequestId(1, 2, 1)).toBe(paypalRequestId(1, 2, 1));
  });
  it("differs across grant, tranche and attempt", () => {
    const ids = [senderBatchId(1, 2, 1), senderBatchId(2, 2, 1), senderBatchId(1, 3, 1), senderBatchId(1, 2, 2)];
    expect(new Set(ids).size).toBe(4);
    const reqs = [paypalRequestId(1, 2, 1), paypalRequestId(2, 2, 1), paypalRequestId(1, 3, 1), paypalRequestId(1, 2, 2)];
    expect(new Set(reqs).size).toBe(4);
  });
  it("is header-safe and within PayPal's sender_batch_id length", () => {
    expect(paypalRequestId(1, 2, 1)).toMatch(/^fg-[0-9a-f]{32}$/);
    expect(senderBatchId(99999, 3, 99)).toMatch(/^[A-Za-z0-9-]{1,100}$/);
  });
});
