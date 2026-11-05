import { randomBytes } from "node:crypto";
// Seed data. Re-running WIPES all app rows and reseeds, so it doubles as "reset demo data".
// Many-to-many by design: CleanWater holds grants from two funders; Wellspring funds two NGOs.
import type Database from "better-sqlite3";
import type { CovenantDefinition, GranteeDocumentRecord } from "@/types/grant";
import { getStandardCovenant } from "./compliance-catalog";
import type { FYModel } from "./fiscal-year";
import { formatUsd } from "./money";

type Req = { required_attendees: number; budget_line_label: string; budget_line_cents: number; tolerance_pct: number };
type TrancheSeed = { amount: number; status: string; req: Req; paidOn?: string };
type GrantSeed = { ngo: number; funder: number; name: string; total: number; start: string; end: string; covenants: CovenantDefinition[]; tranches: TrancheSeed[] };

const FOUNDATIONS: { name: string; fy: FYModel; country: string }[] = [
  { name: "Global Horizon Foundation", fy: "CALENDAR", country: "US" },
  { name: "Wellspring Health Trust", fy: "APRIL_MARCH", country: "GB" },
  { name: "Beacon Global Giving", fy: "CALENDAR", country: "US" },
];

/** Fixed id so tests and docs can refer to Wellspring's custom covenant. */
export const SEED_ME_COVENANT_ID = "5f1b0c1e-7b0a-4f6e-9d1c-3a2b8c4d5e6f";

const doc = (covenantId: string, docNumber: string, expiryDate?: string): GranteeDocumentRecord => ({
  covenantId, status: "ACTIVE", docNumber, ...(expiryDate ? { expiryDate } : {}), addedAt: "2026-01-15T09:00:00.000Z",
});

// Document numbers are obviously fictional ("DEMO-..."). Vault records are self-declared, as they are in the real app.
const NGOS: { name: string; sector: string; country: string; code: string; contact: string; vault: GranteeDocumentRecord[] }[] = [
  {
    name: "CleanWater Initiative", sector: "Sanitation", country: "Rural India (example)", code: "IN", contact: "Asha Verma",
    vault: [
      doc("FCRA_REG", "DEMO-FCRA-0001", "2031-03-31"),
      doc("SBI_NDMB_MANDATE", "DEMO-SBI-0001"),
      doc("TAX_12AB", "DEMO-12AB-0001", "2031-03-31"),
      doc("W8BEN_E", "DEMO-W8-0001", "2029-12-31"),
      doc("OFAC_SANCTIONS_CERT", "DEMO-OFAC-0001", "2030-12-31"),
      doc("SAFEGUARDING_POLICY", "DEMO-SG-0001"),
      doc("AUDITED_ACCOUNTS_PRIOR_FY", "DEMO-AUD-0001", "2026-03-31"), // expired on purpose: Wellspring's grant requires it
    ],
  },
  {
    name: "HealthBridge Vaccine Drive", sector: "Public health", country: "Rural Kenya (example)", code: "KE", contact: "Daniel Otieno",
    vault: [
      doc("NGO_BOARD_REG", "DEMO-NGOB-0001", "2031-06-30"),
      doc("KRA_TAX_EXEMPT", "DEMO-KRA-0001", "2030-12-31"),
      doc("OFAC_SANCTIONS_CERT", "DEMO-OFAC-0002", "2030-12-31"),
      doc("SAFEGUARDING_POLICY", "DEMO-SG-0002"),
    ],
  },
  {
    name: "Sunrise Women's Self-Help Group", sector: "Women's livelihoods", country: "Rural Bangladesh (example)", code: "BD", contact: "Nusrat Jahan",
    vault: [doc("W8BEN_E", "DEMO-W8-0003", "2029-12-31"), doc("OFAC_SANCTIONS_CERT", "DEMO-OFAC-0003", "2030-12-31"), doc("SAFEGUARDING_POLICY", "DEMO-SG-0003")],
  },
];

const req = (attendees: number, label: string, cents: number): Req => ({ required_attendees: attendees, budget_line_label: label, budget_line_cents: cents, tolerance_pct: 10 });
const std = (...ids: string[]) => ids.map((id) => getStandardCovenant(id)!);

// Tranche 2's budget_line is the slice of the tranche that must be evidenced by a receipt (10% tolerance).
// Grants 1-3 use a 25/50/25 split; grant 4 uses 30/40/30. Insertion order fixes the ids the tests rely on (grants 1-3 first).
const GRANTS: GrantSeed[] = [
  {
    ngo: 0, funder: 0, name: "Community Sanitation Units 2026", total: 1_000_000, start: "2026-01-01", end: "2026-12-31",
    covenants: std("FCRA_REG", "SBI_NDMB_MANDATE", "TAX_12AB", "W8BEN_E", "OFAC_SANCTIONS_CERT", "SAFEGUARDING_POLICY"), // US funder + India grantee preset, minus audited accounts
    tranches: [
      { amount: 250_000, status: "PAID", paidOn: "2026-03-12", req: req(0, "Site survey and materials", 250_000) },
      { amount: 500_000, status: "PENDING_EVIDENCE", req: req(50, "Training kits", 250_000) },
      { amount: 250_000, status: "LOCKED", req: req(0, "Unit construction", 250_000) },
    ],
  },
  {
    ngo: 1, funder: 1, name: "Village Immunization Drive 2026", total: 600_000, start: "2026-02-01", end: "2026-12-31",
    covenants: std("NGO_BOARD_REG", "KRA_TAX_EXEMPT", "OFAC_SANCTIONS_CERT", "SAFEGUARDING_POLICY"),
    tranches: [
      { amount: 150_000, status: "PAID", paidOn: "2026-04-08", req: req(0, "Outreach and registration", 150_000) },
      { amount: 300_000, status: "PENDING_EVIDENCE", req: req(120, "Cold-chain supplies", 150_000) },
      { amount: 150_000, status: "LOCKED", req: req(0, "Follow-up clinics", 150_000) },
    ],
  },
  {
    ngo: 2, funder: 2, name: "Women's Tailoring Cooperative 2026", total: 400_000, start: "2026-06-01", end: "2027-05-31",
    covenants: std("W8BEN_E", "OFAC_SANCTIONS_CERT", "SAFEGUARDING_POLICY"),
    tranches: [
      { amount: 100_000, status: "PENDING_EVIDENCE", req: req(25, "Sewing machines", 100_000) },
      { amount: 200_000, status: "LOCKED", req: req(25, "Fabric and materials", 100_000) },
      { amount: 100_000, status: "LOCKED", req: req(0, "Market launch", 100_000) },
    ],
  },
  {
    // Second funder for CleanWater: Wellspring (Apr-Mar FY) also funds HealthBridge above.
    // Deliberately NOT fully compliant: audited accounts are expired and the custom M&E covenant has no document yet,
    // so evidence submitted for this grant stops at Gate 1 until the grantee fixes its vault.
    ngo: 0, funder: 1, name: "Clinic Handwashing and Sanitation 2026-27", total: 600_000, start: "2026-04-01", end: "2027-03-31",
    covenants: [
      ...std("FCRA_REG", "SBI_NDMB_MANDATE", "TAX_12AB", "AUDITED_ACCOUNTS_PRIOR_FY"),
      {
        id: SEED_ME_COVENANT_ID, name: "M&E Baseline Study Sign-Off", category: "CUSTOM", isCustom: true, subcategory: "OPERATIONAL", blocking: true,
        description: "Signed-off monitoring and evaluation baseline study for the clinic sites.",
      },
    ],
    tranches: [
      { amount: 180_000, status: "PAID", paidOn: "2026-05-20", req: req(0, "Baseline assessment", 180_000) },
      { amount: 240_000, status: "PENDING_EVIDENCE", req: req(20, "Handwashing stations", 120_000) },
      { amount: 180_000, status: "LOCKED", req: req(0, "Clinic rollout", 180_000) },
    ],
  },
];

export function seedDatabase(db: Database.Database, emails: [string, string, string]): { tranches: string[] } {
  const lines: string[] = [];
  db.transaction(() => {
    // New epoch for PayPal batch ids: a reseeded demo must never reuse a sender_batch_id PayPal has already seen (see idempotency.ts).
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('payout_epoch', ?)").run(randomBytes(4).toString("hex"));
    for (const t of ["report", "ledger_entry", "submission", "tranche", "grant_award", "ngo", "foundation"]) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('report','ledger_entry','submission','tranche','grant_award','ngo','foundation')");

    const insFoundation = db.prepare("INSERT INTO foundation (name, fy_model, country_code) VALUES (?,?,?)");
    const insNgo = db.prepare("INSERT INTO ngo (name, sector, country_label, country_code, paypal_email, contact_name, compliance_vault) VALUES (?,?,?,?,?,?,?)");
    const insGrant = db.prepare(
      "INSERT INTO grant_award (ngo_id, foundation_id, name, foundation_name, total_cents, start_date, end_date, spend_cap_cents, covenants) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    const insTranche = db.prepare("INSERT INTO tranche (grant_id, seq, amount_cents, requirements, status, disbursed_at) VALUES (?,?,?,?,?,?)");
    const insLedger = db.prepare(
      "INSERT INTO ledger_entry (ngo_id, grant_id, tranche_id, event_type, actor, payload, status, is_seeded, created_at) VALUES (?,?,?,?,?,?,?,1,?)",
    );

    const foundationIds = FOUNDATIONS.map((f) => Number(insFoundation.run(f.name, f.fy, f.country).lastInsertRowid));
    const ngoIds = NGOS.map((n, i) => Number(insNgo.run(n.name, n.sector, n.country, n.code, emails[i], n.contact, JSON.stringify(n.vault)).lastInsertRowid));

    for (const g of GRANTS) {
      // Spend cap = total award: a funder never disburses more than it granted.
      const grantId = Number(
        insGrant.run(ngoIds[g.ngo], foundationIds[g.funder], g.name, FOUNDATIONS[g.funder].name, g.total, g.start, g.end, g.total, JSON.stringify(g.covenants)).lastInsertRowid,
      );
      g.tranches.forEach((t, i) => {
        const trancheId = Number(insTranche.run(grantId, i + 1, t.amount, JSON.stringify(t.req), t.status, t.paidOn ? `${t.paidOn} 09:00:00` : null).lastInsertRowid);
        lines.push(`${FOUNDATIONS[g.funder].name.padEnd(26)} -> ${NGOS[g.ngo].name.padEnd(30)} T${i + 1} ${formatUsd(t.amount).padStart(10)}  ${t.status}`);
        if (t.status === "PAID") {
          // Seeded history only. No PayPal batch/item ids: we never fabricate PayPal responses.
          insLedger.run(
            ngoIds[g.ngo], grantId, trancheId, "PAYOUT_STATUS_UPDATE", "SYSTEM",
            JSON.stringify({ note: "Seeded example: historical tranche already paid before this demo", amount: formatUsd(t.amount) }),
            "SUCCESS", `${t.paidOn} 09:00:00`,
          );
        }
      });
    }
  })();
  return { tranches: lines };
}

export function seedEmailsFromEnv(): [string, string, string] {
  const e = (n: 1 | 2 | 3) => process.env[`NGO${n}_PAYPAL_EMAIL`] || `ngo${n}-unset@example.invalid`;
  return [e(1), e(2), e(3)];
}
