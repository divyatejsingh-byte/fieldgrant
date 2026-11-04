// Saves an API key into your local .env WITHOUT it ever appearing in chat, shell history or logs.
// You run it in your own terminal and paste the key at the hidden prompt.
// A key that wraps across several lines when pasted is joined back into one value.
// Usage: npm.cmd run set-key                 (GEMINI_API_KEY)
//        npm.cmd run set-key -- ANTHROPIC_API_KEY
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ALLOWED = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "PAYPAL_CLIENT_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_WEBHOOK_ID"];
const name = process.argv[2] ?? "GEMINI_API_KEY";
if (!ALLOWED.includes(name)) { console.error(`Name must be one of: ${ALLOWED.join(", ")}`); process.exit(1); }

const envPath = path.resolve(".env");
const examplePath = path.resolve(".env.example");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
// Hide what is typed/pasted: the prompt is printed first, then all echo is suppressed.
let muted = false;
(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => { if (!muted) process.stdout.write(s); };

const lines: string[] = [];
let timer: NodeJS.Timeout | undefined;

function save() {
  rl.close();
  // Joining lines that arrive in one paste fixes keys broken by a line wrap.
  const value = lines.join("").replace(/\s+/g, "");
  if (!value) { console.error("\nNothing saved: the value was empty."); process.exit(1); }
  const base = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "";
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  const next = re.test(base) ? base.replace(re, () => line) : `${base.replace(/\n*$/, "\n")}${line}\n`;
  fs.writeFileSync(envPath, next, { mode: 0o600 });
  console.log(`\nSaved ${name} to .env (${value.length} characters${lines.length > 1 ? `, joined from ${lines.length} pasted lines` : ""}). .env is git-ignored. The value was not printed.`);
  process.exit(0);
}

process.stdout.write(`Paste ${name} (input is hidden), then press Enter: `);
muted = true;
rl.on("line", (l) => {
  lines.push(l);
  clearTimeout(timer);
  timer = setTimeout(save, 600); // wait briefly for the rest of a multi-line paste
});
