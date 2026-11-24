CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  monitor TEXT,
  county_id INTEGER NOT NULL UNIQUE,
  location TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  rain_gauge TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_records (
  provider TEXT NOT NULL,
  stream TEXT NOT NULL,
  scope TEXT NOT NULL,
  record_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  PRIMARY KEY (provider, stream, scope, record_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS provider_records_timeline
  ON provider_records (stream, scope, observed_at DESC);
