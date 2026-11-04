// Extraction reliability. The model's self-reported confidence is a weak signal, so it is only ONE input:
// the main evidence is that two independent runs agree and that code-side scans find nothing suspicious.
import type { NormalizedExtraction, Reliability } from "../rules/types";
import type { Extraction } from "./schema";

export const CONFIDENCE_FLOOR = 0.85;

// WHY: defense in depth against prompt injection. Even if the model is fooled or silent, instruction-like
// text in ANY document-derived string forces human review. Plain regexes, no model involved. This is a net with known
// limits (a determined attacker can always rephrase); it exists so that obvious payloads can never auto-release, and
// the real protection is structural: the model has no authority and its output is never trusted. Errs toward review.
const SUSPICIOUS: RegExp[] = [
  /\bignore\s+(?:\w+\s+){0,3}(?:rules|instructions|checks|guidelines|polic(?:y|ies)|prompt)/i,
  /\bdisregard\s+(?:\w+\s+){0,3}(?:rules|instructions|checks|compliance|polic(?:y|ies)|prompt)/i,
  /\bsystem\s*(?:instructions?|override|notice|message|prompt|directive|command)?\s*:/i, // "SYSTEM:", "SYSTEM INSTRUCTION:"
  /\bsystem\s+(?:instructions?|override|notice|message|prompt|directive|command)\b/i,
  /\bapprove\b.{0,40}\b(?:payment|payout|tranche|release|funds|disbursement)\b/i,
  /\brelease\b.{0,20}\b(?:the\s+)?(?:full\s+)?(?:tranche|payment|funds|payout)\b/i,
  /\b(?:mark|treat|flag|declare|consider|label)\b.{0,40}\b(?:verified|approved|compliant|valid|passed|cleared|trusted|confidence|decision)\b/i,
  /\bset\b.{0,25}\b(?:confidence|decision|status|compliance)\b/i,
  /\bauto\s*release\w*\b/i,
  /\b(?:release|approve|authori[sz]e)\b.{0,30}\b(?:immediately|automatically|right away|without\s+(?:review|checks?|verification))\b/i,
  /\b(?:override|bypass)\b.{0,30}\b(?:rules|checks|polic(?:y|ies)|verification|compliance|review)\b/i,
  /\b(?:AI|assistant|language model|reviewer)\b.{0,20}\b(?:must|should|instructed|override|ignore)\b/i,
  /\bdecision\s*(?:to|=|:)\s*release/i,
];

/** Undo cheap obfuscation before scanning: width/compatibility forms (NFKC), zero-width characters, underscores and hyphens. */
function normalizeForScan(t: string): string {
  return t.normalize("NFKC").replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, "").replace(/[_-]+/g, " ");
}

export function findSuspiciousText(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    const n = normalizeForScan(t);
    for (const re of SUSPICIOUS) if (re.test(n)) return t.slice(0, 120);
  }
  return null;
}

/** All document-derived strings in an extraction, for the suspicious-text scan. */
export function extractionStrings(e: Extraction): string[] {
  return [e.vendor_name, e.total_text, e.receipt_transcription, e.embedded_instructions_quote, ...e.line_items.flatMap((l) => [l.description, l.unit_price_text, l.amount_text])].filter(
    (s): s is string => !!s,
  );
}

const sortedAmounts = (n: NormalizedExtraction) => n.lineItems.map((l) => `${l.quantity}|${l.unitCents}|${l.amountCents}`).sort().join(";");

/** Names the key fields on which two normalized runs disagree. */
export function disagreements(a: NormalizedExtraction, b: NormalizedExtraction): string[] {
  const out: string[] = [];
  if (a.vendorKey !== b.vendorKey) out.push("vendor");
  if (a.dateISO !== b.dateISO) out.push("date");
  if (a.totalCents !== b.totalCents) out.push("total");
  if (a.attendeeCount !== b.attendeeCount) out.push("attendee count");
  if (sortedAmounts(a) !== sortedAmounts(b)) out.push("line items");
  return out;
}

export type RunOutcome = { raw?: Extraction; norm?: NormalizedExtraction; problems: string[]; failed?: string };

export function assessReliability(runs: [RunOutcome, RunOutcome], memoText: string | null): Reliability {
  const reasons: string[] = [];
  const codes: string[] = [];
  runs.forEach((r, i) => {
    if (r.failed) { reasons.push(`Extraction run ${i + 1} failed or produced invalid output (${r.failed}).`); codes.push("EXTRACTION_RUN_FAILED"); }
    else if (r.problems.length) { reasons.push(`Extraction run ${i + 1} had unreadable values: ${r.problems.join("; ")}.`); codes.push("EXTRACTION_UNREADABLE_VALUE"); }
  });

  const good = runs.filter((r): r is RunOutcome & { raw: Extraction; norm: NormalizedExtraction } => !!r.raw && !!r.norm);
  if (good.length === 2) {
    const d = disagreements(good[0].norm, good[1].norm);
    if (d.length) { reasons.push(`The two extraction runs disagree on: ${d.join(", ")}.`); codes.push(`RUNS_DISAGREE:${d.map((f) => f.replaceAll(" ", "_")).join(",")}`); }
  }
  for (const r of good) {
    const c = r.raw.field_confidence;
    const low = Object.entries(c).filter(([, v]) => v < CONFIDENCE_FLOOR).map(([k]) => k);
    if (low.length) { reasons.push(`Model reported low confidence (< ${CONFIDENCE_FLOOR}) on: ${[...new Set(low)].join(", ")}.`); codes.push(`LOW_CONFIDENCE:${[...new Set(low)].join(",")}`); }
    if (r.raw.embedded_instructions_detected) { reasons.push("The documents contain text that tries to instruct an AI/system (treated as data and ignored)."); codes.push("EMBEDDED_INSTRUCTIONS_DETECTED"); }
    const sus = findSuspiciousText(...extractionStrings(r.raw));
    if (sus) { reasons.push("Instruction-like text was found inside extracted fields."); codes.push("INSTRUCTION_LIKE_TEXT_IN_FIELDS"); }
  }
  if (findSuspiciousText(memoText)) { reasons.push("The memo contains instruction-like text aimed at an AI/system."); codes.push("MEMO_INSTRUCTION_LIKE_TEXT"); }

  return { reliable: reasons.length === 0, reasons: [...new Set(reasons)], codes: [...new Set(codes)] };
}
