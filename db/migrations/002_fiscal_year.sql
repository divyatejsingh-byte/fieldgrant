-- Fiscal-year modelling: grantee country, payout dispatch date, and the funder's FY model.

ALTER TABLE ngo ADD COLUMN country_code TEXT NOT NULL DEFAULT 'US';

-- Set when a PayPal payout batch is created for the tranche (cleared again if PayPal reports the payout failed).
-- Disbursed capital is attributed to a fiscal year by this date. Date-time text, UTC.
ALTER TABLE tranche ADD COLUMN disbursed_at TEXT;

-- Single-row configuration for the grantmaker.
CREATE TABLE foundation_settings (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  funder_fy_model  TEXT NOT NULL DEFAULT 'CALENDAR' CHECK (funder_fy_model IN ('CALENDAR','APRIL_MARCH','JULY_JUNE','OCTOBER_SEPTEMBER'))
);
INSERT INTO foundation_settings (id) VALUES (1);
