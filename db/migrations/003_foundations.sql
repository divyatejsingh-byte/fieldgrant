-- Many-to-many funders and grantees: a foundation funds many NGOs, an NGO holds grants from many foundations.
-- Each foundation owns its default fiscal-year model (this replaces the earlier single-row foundation_settings).

CREATE TABLE foundation (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  fy_model  TEXT NOT NULL DEFAULT 'CALENDAR' CHECK (fy_model IN ('CALENDAR','APRIL_MARCH','JULY_JUNE','OCTOBER_SEPTEMBER'))
);

ALTER TABLE grant_award ADD COLUMN foundation_id INTEGER REFERENCES foundation(id);

-- Existing databases: promote the free-text funder names into foundation rows and link them.
INSERT INTO foundation (name, fy_model)
  SELECT DISTINCT g.foundation_name, COALESCE((SELECT funder_fy_model FROM foundation_settings WHERE id = 1), 'CALENDAR') FROM grant_award g;
UPDATE grant_award SET foundation_id = (SELECT f.id FROM foundation f WHERE f.name = grant_award.foundation_name);

DROP TABLE foundation_settings;
CREATE INDEX idx_grant_foundation ON grant_award(foundation_id);
CREATE INDEX idx_grant_ngo ON grant_award(ngo_id);
