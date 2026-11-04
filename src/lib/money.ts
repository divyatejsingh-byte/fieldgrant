// All money is integer cents. Amounts coming from documents arrive as strings
// and are normalized HERE, in code, never by the model and never via floats.

export class MoneyParseError extends Error {}

/** Hard sanity ceiling for any amount read from a document: $1,000,000,000.00. A larger value is far more likely a misread than real. */
const MAX_CENTS = 100_000_000_000n;

/** "$1,050.0" -> 105000, "1.050,00" -> 105000, "USD 12" -> 1200. Throws on anything ambiguous. */
export function parseMoneyToCents(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) throw new MoneyParseError(`Invalid amount: ${input}`);
    // Numbers are accepted only via their decimal string form to avoid float drift.
    return parseMoneyToCents(input.toString());
  }
  let s = input.replace(/[^0-9.,-]/g, "");
  if (!s || s.includes("-")) throw new MoneyParseError(`Invalid amount: "${input}"`);

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSep: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimalSep = lastDot > lastComma ? "." : ",";
  else if (lastComma >= 0) decimalSep = /,\d{1,2}$/.test(s) ? "," : null; // "1,050" is thousands
  else if (lastDot >= 0) decimalSep = /\.\d{1,2}$/.test(s) || /\.\d+$/.test(s) ? "." : null;

  let whole = s;
  let frac = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    whole = s.slice(0, idx);
    frac = s.slice(idx + 1);
  }
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(frac)) throw new MoneyParseError(`Invalid amount: "${input}"`);
  if (frac.length > 2) {
    if (/^0+$/.test(frac.slice(2))) frac = frac.slice(0, 2); // "10.500" style trailing zeros only
    else throw new MoneyParseError(`Too many decimal places: "${input}"`);
  }
  // BigInt keeps the arithmetic exact however many digits the model produced; no float is ever involved.
  const cents = BigInt(whole || "0") * 100n + BigInt(frac.padEnd(2, "0") || "0");
  if (cents > MAX_CENTS) throw new MoneyParseError(`Amount out of range: "${input.slice(0, 40)}"`);
  return Number(cents);
}

/** Integer cents -> "1050.00" (PayPal wants a decimal string). */
export function centsToDecimalString(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Not integer cents: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Integer cents -> "$1,050.00" for display only. */
export function formatUsd(cents: number): string {
  const whole = Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}
