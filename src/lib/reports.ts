import type Database from "better-sqlite3";
import type { StoredFile } from "./uploads";

// Reports are shared documents between a grantee and the funder of the grant. They are stored and listed, never read by the
// model and never part of a payout decision, so nothing a report says can influence money.

export const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<ReportType, { label: string; optional: boolean }> = {
  MONTHLY: { label: "Monthly report", optional: true },
  QUARTERLY: { label: "Quarterly report", optional: false },
  ANNUAL: { label: "Annual report", optional: false },
};

export type ReportRow = {
  id: number; ngo_id: number; ngo_name: string; grant_id: number; grant_name: string; funder_name: string;
  period_type: ReportType; period_label: string; file_name: string; media_type: string; bytes: number;
  note: string | null; created_at: string;
};

const PERIOD_RE: Record<ReportType, RegExp> = {
  MONTHLY: /^(\d{4})-(0[1-9]|1[0-2])$/,
  QUARTERLY: /^(\d{4})-Q[1-4]$/,
  ANNUAL: /^(\d{4})$/,
};

export class ReportError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export const isReportType = (s: string): s is ReportType => (REPORT_TYPES as readonly string[]).includes(s);

/** The period a report covers must look right for its type and be a sensible year. */
export function validatePeriod(type: ReportType, label: string): void {
  const m = PERIOD_RE[type].exec(label);
  if (!m) throw new ReportError(`That period doesn't match a ${REPORT_META[type].label.toLowerCase()}.`);
  const year = Number(m[1]);
  if (year < 2000 || year > 2100) throw new ReportError("Choose a period between 2000 and 2100.");
}

const cleanText = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const cleanFileName = (s: string) => cleanText(s.split(/[\\/]/).pop(), 80) || "report";

export function createReport(
  db: Database.Database,
  input: { ngoId: number; grantId: number; type: ReportType; period: string; file: StoredFile; fileName: string; note?: string },
): number {
  const grant = db.prepare("SELECT ngo_id FROM grant_award WHERE id=?").get(input.grantId) as { ngo_id: number } | undefined;
  if (!grant) throw new ReportError("Grant not found.", 404);
  // A grantee can only report on their own grants.
  if (grant.ngo_id !== input.ngoId) throw new ReportError("That grant belongs to a different organisation.", 403);
  validatePeriod(input.type, input.period);
  return Number(
    db.prepare(
      "INSERT INTO report (ngo_id, grant_id, period_type, period_label, file_path, file_name, media_type, sha256, bytes, note) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(input.ngoId, input.grantId, input.type, input.period, input.file.path, cleanFileName(input.fileName), input.file.mediaType, input.file.sha256, input.file.bytes, cleanText(input.note, 500) || null).lastInsertRowid,
  );
}

/** Newest first. A funder only ever sees reports on its own grants. */
export function listReports(db: Database.Database, f: { ngoId?: number; foundationId?: number } = {}): ReportRow[] {
  const where: string[] = [];
  const args: number[] = [];
  if (f.ngoId) { where.push("r.ngo_id=?"); args.push(f.ngoId); }
  if (f.foundationId) { where.push("g.foundation_id=?"); args.push(f.foundationId); }
  return db.prepare(
    `SELECT r.id, r.ngo_id, n.name AS ngo_name, r.grant_id, g.name AS grant_name, fo.name AS funder_name, r.period_type, r.period_label,
            r.file_name, r.media_type, r.bytes, r.note, r.created_at
       FROM report r JOIN grant_award g ON g.id=r.grant_id JOIN ngo n ON n.id=r.ngo_id JOIN foundation fo ON fo.id=g.foundation_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.id DESC`,
  ).all(...args) as ReportRow[];
}

export function getReportFile(db: Database.Database, id: number) {
  return db.prepare("SELECT file_path, file_name, media_type FROM report WHERE id=?").get(id) as { file_path: string; file_name: string; media_type: string } | undefined;
}
