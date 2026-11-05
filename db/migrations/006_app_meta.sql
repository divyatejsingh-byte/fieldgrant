-- Small key/value settings owned by the app. payout_epoch makes PayPal sender_batch_ids unique across demo resets.
CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
