// Fiscal-year helpers. Pure and deterministic: dates are handled as calendar dates (yyyy-mm-dd), never as local
// time, so the same input gives the same FY on every machine and time zone.

export const FY_MODELS = ["CALENDAR", "APRIL_MARCH", "JULY_JUNE", "OCTOBER_SEPTEMBER"] as const;
export type FYModel = (typeof FY_MODELS)[number];

const START_MONTH: Record<FYModel, number> = { CALENDAR: 1, APRIL_MARCH: 4, JULY_JUNE: 7, OCTOBER_SEPTEMBER: 10 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const isFYModel = (x: unknown): x is FYModel => typeof x === "string" && (FY_MODELS as readonly string[]).includes(x);

type YMD = { y: number; m: number; d: number };

function parse(date: string | Date): YMD {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new RangeError("Invalid Date");
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) throw new RangeError(`Invalid date: "${date}" (expected yyyy-mm-dd)`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) throw new RangeError(`Invalid date: "${date}"`);
  return { y, m: mo, d };
}

/** The calendar year in which the fiscal year containing `date` STARTS. */
export function fiscalYearStart(date: string | Date, model: FYModel): number {
  const { y, m } = parse(date);
  return m >= START_MONTH[model] ? y : y - 1;
}

/** "FY2026" for calendar years; "FY2026-27" for years that span two calendar years (named by their start year). */
export function fyLabel(startYear: number, model: FYModel): string {
  if (model === "CALENDAR") return `FY${startYear}`;
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function getFiscalYear(date: string | Date, model: FYModel): string {
  return fyLabel(fiscalYearStart(date, model), model);
}

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Inclusive first and last day of the fiscal year that starts in `startYear`. */
export function fiscalYearRange(startYear: number, model: FYModel): { start: string; end: string } {
  const sm = START_MONTH[model];
  const endMonth = sm === 1 ? 12 : sm - 1;
  const endYear = sm === 1 ? startYear : startYear + 1;
  return { start: iso(startYear, sm, 1), end: iso(endYear, endMonth, new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate()) };
}

/** "Jan–Dec", "Apr–Mar", ... */
export function fyMonthsLabel(model: FYModel): string {
  const s = START_MONTH[model] - 1;
  return `${MONTHS[s]}–${MONTHS[(s + 11) % 12]}`;
}

export function inFiscalYear(date: string | Date, startYear: number, model: FYModel): boolean {
  return fiscalYearStart(date, model) === startYear;
}

/** Statutory fiscal year a grantee in this country normally reports under. Unknown countries default to calendar. */
const LOCAL_FY: Record<string, FYModel> = { IN: "APRIL_MARCH", GB: "APRIL_MARCH", US: "CALENDAR", KE: "JULY_JUNE", BD: "JULY_JUNE" };
export function defaultLocalFY(countryCode: string | null | undefined): FYModel {
  return LOCAL_FY[(countryCode ?? "").toUpperCase()] ?? "CALENDAR";
}

/**
 * True when the same date lands in differently numbered fiscal years for funder and grantee, e.g. 2026-02-10 is
 * funder FY2026 (calendar) but grantee FY2025-26 (Apr-Mar). Such receipts are reconciled to the FUNDER's year.
 */
export function crossesFiscalBoundary(date: string | Date, funder: FYModel, local: FYModel): boolean {
  return fiscalYearStart(date, funder) !== fiscalYearStart(date, local);
}
