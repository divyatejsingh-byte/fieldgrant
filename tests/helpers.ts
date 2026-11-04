// Shared test helpers: in-memory DB, mock LLM, fake PayPal (a TEST DOUBLE, never a claim about real PayPal behaviour).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { migrate, openDb } from "../src/lib/db";
import type { Extraction } from "../src/lib/extraction/schema";
import type { ExplanationFacts } from "../src/lib/explain-facts";
import type { LlmProvider } from "../src/lib/llm/types";
import type { PayPalApi } from "../src/lib/payout/service";
import { PayPalError, type BatchDetails, type CreatePayoutInput } from "../src/lib/paypal/client";
import { seedDatabase } from "../src/lib/seed";
import { storeUpload } from "../src/lib/uploads";

export const NGO1_T2 = { ngoId: 1, trancheId: 2 };
export const NGO2_T2 = { ngoId: 2, trancheId: 5 };

export function freshDb() {
  process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "fg-uploads-"));
  const db = openDb(":memory:");
  migrate(db);
  seedDatabase(db, ["ngo1@example.test", "ngo2@example.test", "ngo3@example.test"]);
  return db;
}

/** Fake PNG with unique bytes (or fixed bytes when `seed` given, to simulate the identical file). */
export function fakeFile(seed?: string) {
  const body = seed ? Buffer.from(seed) : randomBytes(32);
  return storeUpload(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), body]), "receipt");
}

export function mockLlm(runs: (unknown | Error)[] | unknown, opts: { explainThrows?: boolean; onExplain?: (i: ExplanationFacts) => void; explainReturns?: { explanation: string; remediation_note: string } } = {}): LlmProvider {
  let n = 0;
  return {
    async extract() {
      const r = Array.isArray(runs) ? runs[Math.min(n++, runs.length - 1)] : runs;
      if (r instanceof Error) throw r;
      return r;
    },
    async explain(i) {
      opts.onExplain?.(i);
      if (opts.explainThrows) throw new Error("llm down");
      return opts.explainReturns ?? { explanation: `Decision ${i.decision}.`, remediation_note: "See checks." };
    },
  };
}

export function fakePayPal(o: { configured?: boolean; createError?: PayPalError; batch?: Partial<BatchDetails> } = {}) {
  const calls: CreatePayoutInput[] = [];
  let failNext = o.createError ?? null;
  const api: PayPalApi & { calls: CreatePayoutInput[]; setFail(e: PayPalError | null): void; batch: BatchDetails } = {
    calls,
    batch: { batchStatus: "PENDING", items: [{ payoutItemId: "ITEM-TEST-1", transactionStatus: "PENDING" }], ...o.batch },
    setFail(e) { failNext = e; },
    configured: () => o.configured ?? true,
    async createPayout(i) {
      calls.push(i);
      await new Promise((r) => setTimeout(r, 5));
      if (failNext) throw failNext;
      return { payoutBatchId: `BATCH-TEST-${calls.length}`, batchStatus: "PENDING" };
    },
    async getPayoutBatch() { return api.batch; },
  };
  return api;
}

export type RawExtraction = Extraction;
