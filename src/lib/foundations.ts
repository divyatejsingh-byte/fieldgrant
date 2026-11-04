import type Database from "better-sqlite3";
import { isFYModel, type FYModel } from "./fiscal-year";

export type Foundation = { id: number; name: string; fyModel: FYModel; countryCode: string };
export type FoundationSummary = Foundation & { ngoCount: number; grantCount: number };

const toModel = (m: string): FYModel => (isFYModel(m) ? m : "CALENDAR");

/** The funder's FY model always dictates that funder's portfolio accounting. */
export function getFoundation(db: Database.Database, id: number): Foundation | null {
  const r = db.prepare("SELECT id, name, fy_model, country_code FROM foundation WHERE id=?").get(id) as { id: number; name: string; fy_model: string; country_code: string } | undefined;
  return r ? { id: r.id, name: r.name, fyModel: toModel(r.fy_model), countryCode: r.country_code } : null;
}

export function listFoundations(db: Database.Database): FoundationSummary[] {
  const rows = db
    .prepare(
      `SELECT f.id, f.name, f.fy_model, f.country_code, COUNT(DISTINCT g.ngo_id) AS ngo_count, COUNT(g.id) AS grant_count
       FROM foundation f LEFT JOIN grant_award g ON g.foundation_id = f.id GROUP BY f.id ORDER BY f.id`,
    )
    .all() as { id: number; name: string; fy_model: string; country_code: string; ngo_count: number; grant_count: number }[];
  return rows.map((r) => ({ id: r.id, name: r.name, fyModel: toModel(r.fy_model), countryCode: r.country_code, ngoCount: r.ngo_count, grantCount: r.grant_count }));
}

export function setFoundationFyModel(db: Database.Database, id: number, model: FYModel): boolean {
  return db.prepare("UPDATE foundation SET fy_model=? WHERE id=?").run(model, id).changes > 0;
}
