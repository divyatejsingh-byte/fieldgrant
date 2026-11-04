import { normalizeExtraction } from "./extraction/normalize";
import { ExtractionSchema } from "./extraction/schema";

// Read-only view of the two independent extraction runs, for the "Extraction Consensus" panel. This only DISPLAYS the
// comparison; the decision still comes from reliability.ts + decide.ts. Shown values are what each run read, in cents.

export type RunView = { vendor: string | null; vendorKey: string | null; dateISO: string | null; totalCents: number | null; lineSumCents: number | null; attendees: number | null; injectionFlagged: boolean };
export type ConsensusRow = { key: string; label: string; a: string | null; b: string | null; kind: "text" | "money" | "count"; match: boolean; variancePct: number | null };
export type Consensus = { available: boolean; failed: [string | null, string | null]; rows: ConsensusRow[]; injectionFlagged: boolean };

function viewOf(run: unknown): RunView | null {
  const r = run as { ok?: boolean; data?: unknown } | null;
  if (!r?.ok) return null;
  const p = ExtractionSchema.safeParse(r.data);
  if (!p.success) return null;
  const n = normalizeExtraction(p.data).value;
  const amounts = n.lineItems.map((i) => i.amountCents).filter((c): c is number => c !== null);
  return {
    vendor: n.vendor, vendorKey: n.vendorKey, dateISO: n.dateISO, totalCents: n.totalCents,
    lineSumCents: amounts.length ? amounts.reduce((s, c) => s + c, 0) : null,
    attendees: n.attendeeCount, injectionFlagged: p.data.embedded_instructions_detected,
  };
}

/** % difference of b from a (0 when equal). Null when either side is missing or zero-based comparison is meaningless. */
const variance = (a: number | null, b: number | null) => (a === null || b === null ? null : a === b ? 0 : Math.round((Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1)) * 1000) / 10);

export function buildConsensus(run1: unknown, run2: unknown): Consensus {
  const a = viewOf(run1), b = viewOf(run2);
  const err = (r: unknown) => { const x = r as { ok?: boolean; error?: string } | null; return x && x.ok === false ? "read failed" : null; };
  if (!a || !b) return { available: false, failed: [a ? null : err(run1) ?? "no data", b ? null : err(run2) ?? "no data"], rows: [], injectionFlagged: !!(a?.injectionFlagged || b?.injectionFlagged) };
  const txt = (k: string, label: string, x: string | null, y: string | null, kx: string | null = x, ky: string | null = y): ConsensusRow => ({ key: k, label, a: x, b: y, kind: "text", match: kx === ky, variancePct: null });
  const num = (k: string, label: string, kind: "money" | "count", x: number | null, y: number | null): ConsensusRow => ({
    key: k, label, kind, a: x === null ? null : String(x), b: y === null ? null : String(y), match: x === y, variancePct: variance(x, y),
  });
  return {
    available: true, failed: [null, null], injectionFlagged: a.injectionFlagged || b.injectionFlagged,
    rows: [
      txt("vendor", "Vendor name", a.vendor, b.vendor, a.vendorKey, b.vendorKey),
      txt("date", "Receipt date", a.dateISO, b.dateISO),
      num("total", "Total", "money", a.totalCents, b.totalCents),
      num("lines", "Line item sum", "money", a.lineSumCents, b.lineSumCents),
      num("attendees", "Attendee count", "count", a.attendees, b.attendees),
    ],
  };
}
