-- Compliance covenants (Gate 1): what a grant contract requires, and what the grantee holds in its vault.

-- JSON array of CovenantDefinition declared on the grant contract.
ALTER TABLE grant_award ADD COLUMN covenants TEXT NOT NULL DEFAULT '[]';

-- JSON array of GranteeDocumentRecord (self-declared; reusable across every grant that requires the same document).
ALTER TABLE ngo ADD COLUMN compliance_vault TEXT NOT NULL DEFAULT '[]';

-- Funder location, used to suggest covenant presets (e.g. "US funder + India grantee").
ALTER TABLE foundation ADD COLUMN country_code TEXT NOT NULL DEFAULT 'US';
