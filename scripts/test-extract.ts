// Runs ONE extraction call on sample files and prints the zod-validated result.
// Usage: npm run test:extract                      (defaults to scenario_clean)
//        npm run test:extract -- samples/scenario_injection
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../src/lib/env";
loadEnv();
import { configuredProvider, getLlm, type LlmFile } from "../src/lib/llm";
import { ExtractionSchema } from "../src/lib/extraction/schema";
import { parseMoneyToCents } from "../src/lib/money";

const MEDIA: Record<string, LlmFile["mediaType"]> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

async function main() {
  if (!configuredProvider()) throw new Error("No AI provider configured: set GEMINI_API_KEY + GEMINI_MODEL in .env (see .env.example)");
  const dir = path.resolve(process.argv[2] ?? "samples/scenario_clean");
  if (!fs.existsSync(dir)) throw new Error(`Sample folder not found: ${dir} (run: npm run samples:generate)`);

  const files: LlmFile[] = fs
    .readdirSync(dir)
    .filter((f) => MEDIA[path.extname(f).toLowerCase()])
    .map((f) => ({ name: f, mediaType: MEDIA[path.extname(f).toLowerCase()], base64: fs.readFileSync(path.join(dir, f)).toString("base64") }));
  const memoPath = path.join(dir, "memo.txt");
  const memoText = fs.existsSync(memoPath) ? fs.readFileSync(memoPath, "utf8") : undefined;
  console.log(`Extracting from ${files.map((f) => f.name).join(", ")}${memoText ? " + memo.txt" : ""} ...`);

  const raw = await getLlm().extract({ files, memoText });
  const parsed = ExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    console.log("VALIDATION FAILED (this would route to OFFICER_REVIEW):");
    console.log(parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"));
    console.log("Raw output:", JSON.stringify(raw, null, 2));
    process.exit(2);
  }
  console.log(JSON.stringify(parsed.data, null, 2));
  if (parsed.data.total_text) console.log(`Normalized total (code, not model): ${parseMoneyToCents(parsed.data.total_text)} cents`);
}

main().catch((e) => {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
});
