-- Encrypted sync, rate limits, and the list of revoked codes.
-- Nothing in here is readable: records hold encrypted bytes (ct) only.

CREATE TABLE IF NOT EXISTS sync_spaces (
  sync_id      TEXT PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  last_seq     INTEGER NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0,
  bytes        INTEGER NOT NULL DEFAULT 0,
  owner        TEXT NOT NULL            -- the id inside the unlock code that made it (for a limit per code)
);

CREATE TABLE IF NOT EXISTS sync_records (
  sync_id TEXT NOT NULL,
  rid     TEXT NOT NULL,                -- e.g. debts/<id>, payments/<id>, settings/settings
  ts      INTEGER NOT NULL,             -- time of the change, from the phone (last change wins)
  seq     INTEGER NOT NULL,             -- server number, grows with every accepted change
  deleted INTEGER NOT NULL DEFAULT 0,
  iv      TEXT,
  ct      TEXT,
  size    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sync_id, rid)
);
CREATE INDEX IF NOT EXISTS sync_records_seq ON sync_records (sync_id, seq);

CREATE TABLE IF NOT EXISTS rate_limits (
  k      TEXT NOT NULL,
  window INTEGER NOT NULL,
  n      INTEGER NOT NULL,
  PRIMARY KEY (k, window)
);

-- A refunded order blocks sync only. The code itself keeps working offline on the phone.
CREATE TABLE IF NOT EXISTS revoked (
  code_id    TEXT PRIMARY KEY,
  revoked_at INTEGER NOT NULL,
  reason     TEXT
);
