// Contract-level compliance types shared by the catalog, the rules engine, the API and the UI.

export type CovenantCategory = "STATUTORY" | "GOVERNANCE" | "CUSTOM";
/** Only meaningful for custom covenants: how the funder classifies the requirement. */
export type CustomSubcategory = "GOVERNANCE" | "OPERATIONAL" | "ENVIRONMENTAL_SOCIAL";

/** A requirement written into a grant contract. Stored as JSON in grant_award.covenants. */
export interface CovenantDefinition {
  /** Standard catalog code (e.g. "FCRA_REG") or a UUID for a custom covenant. */
  id: string;
  name: string;
  category: CovenantCategory;
  isCustom: boolean;
  description?: string;
  subcategory?: CustomSubcategory;
  /**
   * Payout blocking (default true). A failing blocking covenant is a HARD failure (HOLD, before any extraction).
   * A failing non-blocking covenant is a SOFT failure (officer review).
   */
  blocking?: boolean;
}

export type DocumentStatus = "ACTIVE" | "REVOKED" | "PENDING";

/** A document the grantee holds in its vault. Stored as JSON in ngo.compliance_vault. SELF-DECLARED: not verified against any registry. */
export interface GranteeDocumentRecord {
  covenantId: string;
  status: DocumentStatus;
  docNumber?: string;
  issuedDate?: string; // yyyy-mm-dd
  expiryDate?: string; // yyyy-mm-dd; absent means the document does not expire
  fileName?: string;
  fileHash?: string; // SHA-256 of an uploaded copy, if any
  addedAt: string; // ISO date-time
}

/** What a covenant looks like against the vault on a given day. */
export type CovenantState = "ACTIVE" | "EXPIRED" | "MISSING" | "REVOKED" | "PENDING";
