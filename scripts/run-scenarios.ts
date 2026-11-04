// Runs the sample scenarios through the REAL pipeline with the REAL model against a throwaway in-memory DB.
// It never calls PayPal and never pays. Reports honestly when a result differs from the expected band.
// Usage: npm run test:scenarios            (all five)
//        npm run test:scenarios -- injection
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../src/lib/env";
loadEnv();
import { migrate, openDb } from "../src/lib/db";
import { configuredProvider, getLlm } from "../src/lib/llm";
import { processSubmission } from "../src/lib/pipeline";
import { seedDatabase } from "../src/lib/seed";
import { storeUpload } from "../src/lib/uploads";

process.env.UPLOADS_DIR = path.resolve("data", "scenario-uploads");

const NGO1_T2 = { ngoId: 1, trancheId: 2 };
const NGO2_T2 = { ngoId: 2, trancheId: 5 };
const SCENARIOS: { name: string; who: typeof NGO1_T2; ok: (d: string) => boolean; expect: string; needsClean?: boolean }[] = [
  { name: "clean", who: NGO1_T2, ok: (d) => d === "RELEASE", expect: "RELEASE" },
  { name: "overspend", who: NGO1_T2, ok: (d) => d === "HOLD", expect: "HOLD" },
  { name: "injection", who: NGO1_T2, ok: (d) => d !== "RELEASE", expect: "anything but RELEASE" },
  { name: "duplicate", who: NGO2_T2, ok: (d) => d === "HOLD", expect: "HOLD (cross-NGO duplicate)", needsClean: true },
  { name: "lowquality", who: NGO1_T2, ok: (d) => d === "OFFICER_REVIEW", expect: "OFFICER_REVIEW" },
];

async function submit(db: ReturnType<typeof openDb>, scenario: string, who: typeof NGO1_T2) {
  const dir = path.resolve("samples", `scenario_${scenario}`);
  if (!fs.existsSync(dir)) throw new Error(`Missing ${dir} (run: npm run samples:generate)`);
  const receipt = storeUpload(fs.readFileSync(path.join(dir, "receipt.png")), "receipt");
  const roster = storeUpload(fs.readFileSync(path.join(dir, "roster.pdf")), "roster");
  const memoText = fs.readFileSync(path.join(dir, "memo.txt"), "utf8");
  return processSubmission({ db, llm: getLlm() }, { ...who, receipt, roster, memoText });
}

async function main() {
  if (!configuredProvider()) throw new Error("No AI provider configured: set GEMINI_API_KEY + GEMINI_MODEL in .env (see .env.example)");
  const only = process.argv[2];
  let failures = 0;
  for (const s of SCENARIOS.filter((x) => !only || x.name === only)) {
    const db = openDb(":memory:");
    migrate(db);
    seedDatabase(db, ["a@example.test", "b@example.test", "c@example.test"]);
    if (s.needsClean) await submit(db, "clean", NGO1_T2);
    const r = await submit(db, s.name, s.who);
    const pass = s.ok(r.decision);
    if (!pass) failures++;
    // Which explainer wrote the note: the model, or the deterministic fallback (and why)?
    const made = db.prepare("SELECT payload FROM ledger_entry WHERE event_type='DECISION_MADE' AND submission_id=?").get(r.submissionId) as { payload: string } | undefined;
    const meta = made ? JSON.parse(made.payload) : {};
    const explainer = meta.explanation_source === "llm" ? "llm" : `fallback(${meta.fallback_reason ?? "?"})`;
    console.log(`${pass ? "PASS" : "FAIL"}  ${s.name.padEnd(11)} decision=${r.decision.padEnd(14)} explainer=${explainer.padEnd(22)} expected ${s.expect}`);
    for (const reason of r.reasons.slice(0, 3)) console.log(`        - ${reason.slice(0, 160)}`);
  }
  if (failures) { console.log(`\n${failures} scenario(s) differed from expectation (model-dependent; inspect the reasons above).`); process.exit(1); }
}

main().catch((e) => { console.error(`Error: ${(e as Error).message}`); process.exit(1); });
