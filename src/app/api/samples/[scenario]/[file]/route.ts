import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Read-only access to the synthetic demo documents in /samples, so anyone can try the demo without hunting for files.
// Whitelisted names only: nothing here can reach any other file.
const SCENARIOS = new Set(["clean", "overspend", "injection", "duplicate", "lowquality"]);
const FILES: Record<string, string> = { "receipt.png": "image/png", "roster.pdf": "application/pdf", "memo.txt": "text/plain; charset=utf-8" };

export async function GET(_: Request, { params }: { params: Promise<{ scenario: string; file: string }> }) {
  const { scenario, file } = await params;
  if (!SCENARIOS.has(scenario) || !(file in FILES)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = path.join(process.cwd(), "samples", `scenario_${scenario}`, file);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "Sample files are not generated (run: npm run samples:generate)" }, { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(p)), { headers: { "Content-Type": FILES[file], "Cache-Control": "no-store" } });
}
