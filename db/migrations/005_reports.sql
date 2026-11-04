-- Periodic progress reports (monthly optional, quarterly, annual). Shared by the grantee with the funder of the grant.
-- Reports are documents only: they never enter the extraction pipeline, the rules engine or a payout decision.
CREATE TABLE report (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ngo_id       INTEGER NOT NULL REFERENCES ngo(id),
  grant_id     INTEGER NOT NULL REFERENCES grant_award(id),
  period_type  TEXT NOT NULL CHECK (period_type IN ('MONTHLY','QUARTERLY','ANNUAL')),
  period_label TEXT NOT NULL,            -- 2026-10 | 2026-Q3 | 2026
  file_path    TEXT NOT NULL,
  file_name    TEXT NOT NULL,            -- display only, sanitized
  media_type   TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  note         TEXT,                     -- grantee text, display only, length-limited
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_report_grant ON report(grant_id);
CREATE INDEX idx_report_ngo ON report(ngo_id);
