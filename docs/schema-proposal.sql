-- Superseded implementation: see migrations/0001_weather.sql.
-- REVIEW PROPOSAL ONLY: not a migration and not deployed.
-- Target: Cloudflare D1 / SQLite. Foreign keys are enforced by D1.
-- Coordinates are signed integer microdegrees: round(degrees * 1,000,000).
-- The canonical requested coordinate is the location identity, not the grid
-- coordinate returned by a provider. Source/station coordinates are separate.
-- All local timestamps: YYYY-MM-DDTHH:MM:SS-08:00 (fixed PST, no DST).
-- All dates: YYYY-MM-DD in fixed PST. Units are explicit in column names.

CREATE TABLE locations (
  latitude_e6 INTEGER NOT NULL CHECK(latitude_e6 BETWEEN -90000000 AND 90000000),
  longitude_e6 INTEGER NOT NULL CHECK(longitude_e6 BETWEEN -180000000 AND 180000000),
  name TEXT NOT NULL,
  group_name TEXT,
  PRIMARY KEY(latitude_e6, longitude_e6)
);

-- A source identifies a provider dataset/model/station, not just a provider.
-- E.g. NOAA station 9414290 or an Open-Meteo model/product.
-- source coordinates record where a station/grid value really comes from.
-- API-controlled IDs include station/grid/model discriminators where applicable;
-- distinct sampled grid coordinates must not share a source-coordinate record.
CREATE TABLE data_sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  dataset TEXT NOT NULL,
  station_id TEXT,
  model TEXT,
  source_latitude_e6 INTEGER CHECK(source_latitude_e6 BETWEEN -90000000 AND 90000000),
  source_longitude_e6 INTEGER CHECK(source_longitude_e6 BETWEEN -180000000 AND 180000000)
);

CREATE TABLE hourly_weather (
  latitude_e6 INTEGER NOT NULL,
  longitude_e6 INTEGER NOT NULL,
  hour_pst TEXT NOT NULL CHECK(length(hour_pst) = 25 AND substr(hour_pst,14) = ':00:00-08:00'),
  data_kind TEXT NOT NULL CHECK(data_kind IN ('forecast','observation','reanalysis')),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  temperature_f REAL,
  uv_index REAL CHECK(uv_index >= 0),
  rainfall_in REAL CHECK(rainfall_in >= 0),
  wind_speed_mph REAL CHECK(wind_speed_mph >= 0),
  wind_direction_deg REAL CHECK(wind_direction_deg >= 0 AND wind_direction_deg < 360),
  weather_code INTEGER,
  source_issued_at_pst TEXT, -- actual provider issuance/revision, if supplied
  source_retrieved_at_pst TEXT NOT NULL, -- capture once when fetching, not retrying
  updated_at_pst TEXT NOT NULL, -- API-generated receipt time
  PRIMARY KEY(latitude_e6, longitude_e6, hour_pst, data_kind, source_id),
  FOREIGN KEY(latitude_e6, longitude_e6) REFERENCES locations(latitude_e6, longitude_e6),
  CHECK(temperature_f IS NOT NULL OR uv_index IS NOT NULL OR rainfall_in IS NOT NULL
    OR wind_speed_mph IS NOT NULL OR wind_direction_deg IS NOT NULL OR weather_code IS NOT NULL)
);
-- Rainfall is liquid rain, not total precipitation including snow.
-- All hourly rainfall represents [hour_pst, hour_pst + 1 hour).
-- Adapters MUST shift provider interval-ending timestamps to interval start.
-- Point weather values are aligned to the hour; UV is unitless.
-- Incomplete/unknown rain intervals are NULL, never implicit zero.

CREATE TABLE hourly_tides (
  latitude_e6 INTEGER NOT NULL,
  longitude_e6 INTEGER NOT NULL,
  hour_pst TEXT NOT NULL CHECK(length(hour_pst) = 25 AND substr(hour_pst,14) = ':00:00-08:00'),
  data_kind TEXT NOT NULL CHECK(data_kind IN ('forecast','observation')),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  datum TEXT NOT NULL DEFAULT 'MLLW',
  height_ft REAL NOT NULL, -- may be negative relative to datum
  source_issued_at_pst TEXT,
  source_retrieved_at_pst TEXT NOT NULL,
  updated_at_pst TEXT NOT NULL,
  PRIMARY KEY(latitude_e6, longitude_e6, hour_pst, data_kind, source_id, datum),
  FOREIGN KEY(latitude_e6, longitude_e6) REFERENCES locations(latitude_e6, longitude_e6)
);

CREATE TABLE daily_water_temperature (
  latitude_e6 INTEGER NOT NULL,
  longitude_e6 INTEGER NOT NULL,
  date_pst TEXT NOT NULL CHECK(length(date_pst) = 10),
  data_kind TEXT NOT NULL CHECK(data_kind IN ('forecast','observation','reanalysis')),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  mean_temperature_f REAL NOT NULL,
  sample_count INTEGER NOT NULL CHECK(sample_count > 0),
  is_complete INTEGER NOT NULL DEFAULT 0 CHECK(is_complete IN (0,1)),
  source_issued_at_pst TEXT,
  source_retrieved_at_pst TEXT NOT NULL,
  updated_at_pst TEXT NOT NULL,
  PRIMARY KEY(latitude_e6, longitude_e6, date_pst, data_kind, source_id),
  FOREIGN KEY(latitude_e6, longitude_e6) REFERENCES locations(latitude_e6, longitude_e6)
);
-- Daily water temperature is the mean of the source's samples in the PST day.
-- Never combine forecast and observation samples into the same daily row.
-- An in-progress observed day remains is_complete=0.

CREATE TABLE daily_sun_times (
  latitude_e6 INTEGER NOT NULL,
  longitude_e6 INTEGER NOT NULL,
  date_pst TEXT NOT NULL CHECK(length(date_pst) = 10),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  sunrise_pst TEXT, -- nullable for locations with no sunrise/sunset that day
  sunset_pst TEXT,
  source_retrieved_at_pst TEXT NOT NULL,
  updated_at_pst TEXT NOT NULL,
  PRIMARY KEY(latitude_e6, longitude_e6, date_pst, source_id),
  FOREIGN KEY(latitude_e6, longitude_e6) REFERENCES locations(latitude_e6, longitude_e6)
);

-- Read contract (API logic, not a wall-clock-dependent SQL view):
-- * Select by coordinates + bounded time/date range.
-- * Future/in-progress hourly intervals: prefer forecast data.
-- * Completed hourly intervals: prefer observation PER FIELD, not whole row.
-- * If an observation is absent, return NULL or explicitly labelled model
--   fallback; never silently present forecasts/reanalysis as measurements.
-- * Rain totals use observation rows only, one preferred source per hour.
--   Return interval coverage alongside SUM(rainfall_in); partial coverage is
--   not a complete rainfall total. Never sum multiple stations for one hour.
-- * Sunrise/sunset are astronomical events, so have no observation/forecast split.
-- * Daily water chooses forecast for future days, observations for past days;
--   current-day observations can be partial, with is_complete exposed.

-- Write contract:
-- * Client fetches source + DB on each load, rendering skeleton immediately.
-- * A fresh successful source result wins over DB for the same semantic key;
--   compare normalized values, NOT request/update timestamps.
-- * Client POSTs only changed/new values to Pages Functions. Browser does not
--   receive SQL access or D1 credentials. API validates and rechecks the diff.
-- * UPSERT on the relevant primary key. Partial source responses update only
--   fields present in the request; absent fields must not erase saved fields.
-- * API skips value-identical updates. No per-refresh snapshot/history table.
-- * Compare actual source revisions when available to reject older in-flight
--   results. Otherwise retrieval time only orders requests; it cannot prove
--   which provider model version is newer. Retries retain original timestamps.
-- * Client uploads remain client-reported; these timestamps do not prove origin.
-- * Schema/time parsing and configured source/station eligibility are checked
--   by the API; SQLite shape checks above do not validate full calendar dates.
