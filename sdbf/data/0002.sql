CREATE TABLE IF NOT EXISTS feed_snapshots (
  name TEXT PRIMARY KEY,
  verified_at TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload))
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS refresh_attempts (
  name TEXT PRIMARY KEY,
  requested_at INTEGER NOT NULL
) WITHOUT ROWID;
