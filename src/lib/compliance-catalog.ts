// Master catalog of recognised statutory and funder-standard documents, keyed by country.
// The catalog is the single source of truth for standard covenant names: the API re-applies these canonical
// definitions on save, so a client cannot rename a statutory requirement.
import type { CovenantDefinition, CustomSubcategory } from "@/types/grant";

export type CatalogRegion = "IN" | "KE" | "US" | "GLOBAL";

type Entry = Omit<CovenantDefinition, "isCustom" | "blocking"> & { region: CatalogRegion };

const CATALOG: Entry[] = [
  // India
  { id: "FCRA_REG", region: "IN", category: "STATUTORY", name: "MHA FCRA Registration", description: "Foreign Contribution (Regulation) Act registration with the Ministry of Home Affairs." },
  { id: "SBI_NDMB_MANDATE", region: "IN", category: "STATUTORY", name: "SBI Designated Account", description: "Designated foreign-contribution account with State Bank of India (New Delhi Main Branch)." },
  { id: "TAX_12AB", region: "IN", category: "STATUTORY", name: "Income Tax Sec 12AB Registration", description: "Income Tax Act section 12AB registration for charitable trusts." },
  // Kenya
  { id: "NGO_BOARD_REG", region: "KE", category: "STATUTORY", name: "NGO Coordination Board License", description: "Registration certificate from the NGO Coordination Board." },
  { id: "KRA_TAX_EXEMPT", region: "KE", category: "STATUTORY", name: "KRA Tax Exemption Certificate", description: "Kenya Revenue Authority income tax exemption." },
  // United States
  { id: "501C3_LETTER", region: "US", category: "STATUTORY", name: "IRS 501(c)(3) Determination Letter", description: "IRS determination of tax-exempt status." },
  { id: "W8BEN_E", region: "US", category: "STATUTORY", name: "Form W-8BEN-E (Foreign Tax Status)", description: "Certificate of foreign status of beneficial owner, requested by US funders from non-US grantees." },
  // Funder standard (applies everywhere)
  { id: "OFAC_SANCTIONS_CERT", region: "GLOBAL", category: "GOVERNANCE", name: "OFAC Sanctions Screening Certificate", description: "Evidence the organisation and its principals were screened against sanctions lists." },
  { id: "AUDITED_ACCOUNTS_PRIOR_FY", region: "GLOBAL", category: "GOVERNANCE", name: "Audited Accounts (Prior FY)", description: "Independently audited financial statements for the prior fiscal year." },
  { id: "SAFEGUARDING_POLICY", region: "GLOBAL", category: "GOVERNANCE", name: "Safeguarding Policy", description: "Board-approved safeguarding and child-protection policy." },
];

const byId = new Map(CATALOG.map((e) => [e.id, e]));

export const REGION_LABEL: Record<CatalogRegion, string> = {
  IN: "India", KE: "Kenya", US: "United States", GLOBAL: "Funder standard (global)",
};

const toDefinition = (e: Entry, blocking = true): CovenantDefinition => ({
  id: e.id, name: e.name, category: e.category, isCustom: false, description: e.description, blocking,
});

export function isStandardCovenantId(id: string): boolean {
  return byId.has(id);
}

/** Canonical definition for a standard code, or null. */
export function getStandardCovenant(id: string, blocking = true): CovenantDefinition | null {
  const e = byId.get(id);
  return e ? toDefinition(e, blocking) : null;
}

/** The whole catalog, grouped for pickers. */
export function listCatalog(): { region: CatalogRegion; label: string; covenants: CovenantDefinition[] }[] {
  return (["IN", "KE", "US", "GLOBAL"] as const).map((region) => ({
    region,
    label: REGION_LABEL[region],
    covenants: CATALOG.filter((e) => e.region === region).map((e) => toDefinition(e)),
  }));
}

/**
 * Location-aware preset for a funder/grantee pair, in a stable order:
 *  1. the grantee country's statutory documents (IN, KE, US have catalog entries; other countries have none yet),
 *  2. Form W-8BEN-E when a US funder supports a non-US grantee (a foreign entity certifies its tax status),
 *  3. the funder-standard governance set that applies everywhere.
 * Suggestions are a starting point: the funder can remove any of them or add custom covenants.
 */
export function getSuggestedCovenants(funderCountry: string, granteeCountry: string): CovenantDefinition[] {
  const f = funderCountry.trim().toUpperCase();
  const g = granteeCountry.trim().toUpperCase();
  const ids: string[] = [];
  for (const e of CATALOG) if (e.region === g && !(e.id === "W8BEN_E")) ids.push(e.id);
  if (f === "US" && g !== "US") ids.push("W8BEN_E");
  for (const e of CATALOG) if (e.region === "GLOBAL") ids.push(e.id);
  return ids.map((id) => getStandardCovenant(id)!);
}

const SUBCATEGORIES: CustomSubcategory[] = ["GOVERNANCE", "OPERATIONAL", "ENVIRONMENTAL_SOCIAL"];
export const isSubcategory = (x: unknown): x is CustomSubcategory => SUBCATEGORIES.includes(x as CustomSubcategory);
export const SUBCATEGORY_LABEL: Record<CustomSubcategory, string> = {
  GOVERNANCE: "Governance", OPERATIONAL: "Operational", ENVIRONMENTAL_SOCIAL: "Environmental / Social",
};

export class CovenantInputError extends Error {}

const cleanText = (s: unknown, max: number) =>
  String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates and normalises covenants coming from the client.
 * Standard codes are re-resolved from the catalog (name, category and description cannot be spoofed; only `blocking`
 * is taken from the client). Custom covenants get a server-checked UUID, a length-limited single-line name, and a
 * sub-category. Duplicates are rejected.
 */
export function normalizeCovenants(input: unknown): CovenantDefinition[] {
  if (!Array.isArray(input)) throw new CovenantInputError("covenants must be an array.");
  if (input.length > 30) throw new CovenantInputError("A grant can have at most 30 covenants.");
  const out: CovenantDefinition[] = [];
  const ids = new Set<string>();
  const customNames = new Set<string>();
  for (const raw of input as Record<string, unknown>[]) {
    const blocking = raw?.blocking === false ? false : true;
    const rawId = String(raw?.id ?? "");
    // A standard code ALWAYS resolves to the catalog definition, whatever the client claims about isCustom.
    const std = getStandardCovenant(rawId, blocking);
    let def: CovenantDefinition;
    if (std) {
      def = std;
    } else {
      const name = cleanText(raw?.name, 120);
      if (name.length < 3) throw new CovenantInputError("A custom covenant needs a name of at least 3 characters.");
      if (customNames.has(name.toLowerCase())) throw new CovenantInputError(`Duplicate covenant: ${name}`);
      customNames.add(name.toLowerCase());
      const description = cleanText(raw?.description, 300);
      def = {
        id: UUID.test(rawId) ? rawId.toLowerCase() : globalThis.crypto.randomUUID(),
        name,
        category: "CUSTOM",
        isCustom: true,
        subcategory: isSubcategory(raw?.subcategory) ? raw.subcategory : "GOVERNANCE",
        blocking,
        ...(description ? { description } : {}),
      };
    }
    if (ids.has(def.id)) throw new CovenantInputError(`Duplicate covenant: ${def.name}`);
    ids.add(def.id);
    out.push(def);
  }
  return out;
}

/** Display label for where a requirement comes from. */
export function covenantSource(c: Pick<CovenantDefinition, "category">): string {
  return c.category === "STATUTORY" ? "The law" : c.category === "GOVERNANCE" ? "Funder's standard" : "Funder's own requirement";
}

const COUNTRY_NAME: Record<string, string> = { US: "US", GB: "UK", IN: "India", KE: "Kenya", BD: "Bangladesh" };
/** Short country label for presets ("US Funder + India Grantee Preset"); falls back to the code. */
export const countryName = (code: string) => COUNTRY_NAME[code.toUpperCase()] ?? code.toUpperCase();
