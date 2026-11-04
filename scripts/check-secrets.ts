// Scans the working tree for things that look like API keys / secrets before you push to GitHub.
// Prints file:line and the rule name only, never the secret itself. Exit code 1 if anything is found.
// Usage: npm run check:secrets
import fs from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "data", "uploads", "uploads-smoke", "samples"]);
const SKIP_FILES = new Set([".env", "package-lock.json", "tsconfig.tsbuildinfo"]); // .env is git-ignored by design
const TEXT_EXT = /\.(ts|tsx|js|mjs|json|md|yaml|yml|txt|env|example|sql|css|html)$|^\.env\./;

const RULES: [string, RegExp][] = [
  ["Google/Gemini API key (AIza...)", /AIza[0-9A-Za-z_-]{30,}/],
  ["Google API key (AQ. format)", /\bAQ\.[A-Za-z0-9_-]{30,}/],
  ["Anthropic key (sk-ant-...)", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["Secret assigned a real-looking value", /(GEMINI_API_KEY|ANTHROPIC_API_KEY|PAYPAL_CLIENT_SECRET|client_secret)\s*[=:]\s*["']?[A-Za-z0-9_.\-]{20,}/i],
  ["PayPal-style client secret (E...)", /\bE[A-Za-z0-9_-]{60,}\b/],
];

const hits: string[] = [];
function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (SKIP_FILES.has(e.name) || !TEXT_EXT.test(e.name)) continue;
    const file = path.join(dir, e.name);
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      for (const [rule, re] of RULES) if (re.test(line)) hits.push(`${path.relative(".", file)}:${i + 1}  ${rule}`);
    });
  }
}
walk(path.resolve("."));

const gi = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8").split(/\r?\n/) : [];
const ignoresEnv = gi.some((l) => l.trim() === ".env");
if (!ignoresEnv) hits.push(".gitignore:0  .env is NOT git-ignored");

if (hits.length) { console.error(`Possible secrets found:\n${hits.map((h) => `  ${h}`).join("\n")}`); process.exit(1); }
console.log("OK: no secret-like values found in files that would be committed, and .env is git-ignored.");
