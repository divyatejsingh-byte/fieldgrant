// DB access for covenants and the grantee vault. Business rules live in compliance-catalog.ts and rules/covenants.ts.
import type Database from "better-sqlite3";
import { getSuggestedCovenants, normalizeCovenants } from "./compliance-catalog";
import { evaluateComplianceCovenants, toISODate, type ComplianceEvaluation } from "./rules/covenants";
import type { CovenantDefinition, GranteeDocumentRecord } from "@/types/grant";

const parse = <T>(s: string | null | undefined, fallback: T): T => {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
};

export const parseCovenants = (s: string | null | undefined) => parse<CovenantDefinition[]>(s, []);
export const parseVault = (s: string | null | undefined) => parse<GranteeDocumentRecord[]>(s, []);

export function getVault(db: Database.Database, ngoId: number): GranteeDocumentRecord[] {
  const r = db.prepare("SELECT compliance_vault FROM ngo WHERE id=?").get(ngoId) as { compliance_vault: string } | undefined;
  return parseVault(r?.compliance_vault);
}

/** One record per covenant id: adding a new document replaces the previous one for that requirement. */
export function upsertVaultRecord(db: Database.Database, ngoId: number, rec: GranteeDocumentRecord): GranteeDocumentRecord[] {
  const next = [...getVault(db, ngoId).filter((v) => v.covenantId !== rec.covenantId), rec];
  db.prepare("UPDATE ngo SET compliance_vault=? WHERE id=?").run(JSON.stringify(next), ngoId);
  return next;
}

export function saveGrantCovenants(db: Database.Database, grantId: number, input: unknown): CovenantDefinition[] {
  const covenants = normalizeCovenants(input);
  db.prepare("UPDATE grant_award SET covenants=? WHERE id=?").run(JSON.stringify(covenants), grantId);
  return covenants;
}

/** Flat, UI-ready view of one covenant against the vault. */
export type CovenantRow = {
  id: string; name: string; category: CovenantDefinition["category"]; isCustom: boolean; subcategory?: CovenantDefinition["subcategory"];
  description?: string; blocking: boolean; state: ComplianceEvaluation["results"][number]["state"]; passed: boolean;
  docNumber?: string; expiryDate?: string; fileName?: string; fileHash?: string;
};

export function covenantRows(ev: ComplianceEvaluation): CovenantRow[] {
  return ev.results.map((r) => ({
    id: r.covenant.id, name: r.covenant.name, category: r.covenant.category, isCustom: r.covenant.isCustom, subcategory: r.covenant.subcategory,
    description: r.covenant.description, blocking: r.blocking, state: r.state, passed: r.passed,
    docNumber: r.record?.docNumber, expiryDate: r.record?.expiryDate, fileName: r.record?.fileName, fileHash: r.record?.fileHash,
  }));
}

export type GrantCompliance = {
  grant: { id: number; name: string };
  funder: { id: number; name: string; country: string };
  ngo: { id: number; name: string; country: string };
  covenants: CovenantDefinition[];
  evaluation: ComplianceEvaluation;
  rows: CovenantRow[];
  suggested: CovenantDefinition[];
  vault: GranteeDocumentRecord[];
};

/** Everything the covenant editor and the grantee checklist need for one grant. */
export function grantCompliance(db: Database.Database, grantId: number, today: Date = new Date()): GrantCompliance | null {
  const g = db
    .prepare(
      `SELECT g.id, g.name, g.covenants, n.id AS ngo_id, n.name AS ngo_name, n.country_code AS ngo_country, n.compliance_vault,
              f.id AS f_id, f.name AS f_name, f.country_code AS f_country
       FROM grant_award g JOIN ngo n ON n.id=g.ngo_id LEFT JOIN foundation f ON f.id=g.foundation_id WHERE g.id=?`,
    )
    .get(grantId) as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!g) return null;
  const covenants = parseCovenants(g.covenants);
  const vault = parseVault(g.compliance_vault);
  const evaluation = evaluateComplianceCovenants(covenants, vault, today);
  return {
    grant: { id: g.id, name: g.name },
    funder: { id: g.f_id, name: g.f_name ?? "Unknown funder", country: g.f_country ?? "US" },
    ngo: { id: g.ngo_id, name: g.ngo_name, country: g.ngo_country },
    covenants,
    evaluation,
    rows: covenantRows(evaluation),
    suggested: getSuggestedCovenants(g.f_country ?? "US", g.ngo_country),
    vault,
  };
}

export { toISODate };
