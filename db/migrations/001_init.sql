-- All money columns are INTEGER cents. JSON columns hold TEXT (validated with zod in app code).

CREATE TABLE ngo (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  sector        TEXT NOT NULL,
  country_label TEXT NOT NULL,
  paypal_email  TEXT NOT NULL,
  contact_name  TEXT NOT NULL
);

CREATE TABLE grant_award (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ngo_id           INTEGER NOT NULL REFERENCES ngo(id),
  name             TEXT NOT NULL,
  foundation_name  TEXT NOT NULL,
  total_cents      INTEGER NOT NULL CHECK (total_cents > 0),
  start_date       TEXT NOT NULL,   -- ISO yyyy-mm-dd
  end_date         TEXT NOT NULL,
  spend_cap_cents  INTEGER NOT NULL CHECK (spend_cap_cents > 0)
);

CREATE TABLE tranche (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_id      INTEGER NOT NULL REFERENCES grant_award(id),
  seq           INTEGER NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  requirements  TEXT NOT NULL,      -- JSON: required_attendees, budget_line_label, budget_line_cents, tolerance_pct
  status        TEXT NOT NULL CHECK (status IN ('LOCKED','PENDING_EVIDENCE','IN_REVIEW','RELEASING','PAID','HELD')),
  UNIQUE (grant_id, seq)
);

CREATE TABLE submission (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tranche_id        INTEGER NOT NULL REFERENCES tranche(id),
  ngo_id            INTEGER NOT NULL REFERENCES ngo(id),
  file_paths        TEXT NOT NULL,  -- JSON array
  file_hashes       TEXT NOT NULL,  -- JSON array of SHA-256 hex
  memo_text         TEXT,
  extracted_run1    TEXT,           -- JSON
  extracted_run2    TEXT,
  extracted_final   TEXT,
  check_results     TEXT,
  decision          TEXT CHECK (decision IN ('RELEASE','OFFICER_REVIEW','HOLD')),
  decision_reason   TEXT,
  llm_explanation   TEXT,
  remediation_note  TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ledger_entry (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ngo_id           INTEGER NOT NULL REFERENCES ngo(id),
  grant_id         INTEGER NOT NULL REFERENCES grant_award(id),
  tranche_id       INTEGER NOT NULL REFERENCES tranche(id),
  submission_id    INTEGER REFERENCES submission(id),
  event_type       TEXT NOT NULL,
  actor            TEXT NOT NULL CHECK (actor IN ('SYSTEM','OFFICER','WEBHOOK')),
  payload          TEXT NOT NULL DEFAULT '{}',
  payout_batch_id  TEXT,
  payout_item_id   TEXT,
  status           TEXT,
  is_seeded        INTEGER NOT NULL DEFAULT 0 CHECK (is_seeded IN (0,1)),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_submission_tranche ON submission(tranche_id);
CREATE INDEX idx_ledger_ngo ON ledger_entry(ngo_id);
CREATE INDEX idx_ledger_batch ON ledger_entry(payout_batch_id);
