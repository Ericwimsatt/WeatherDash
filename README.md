# WeatherDash

A client-rendered Octane weather dashboard on Cloudflare Pages, with TanStack
Query and a normalized D1/SQLite database. Static assets are delivered by Pages;
only `/api/*` invokes Functions. The original Sunline dashboard styling remains.

## Run locally

Requires Node 22.22.2 or later (Node 24+ recommended for the native TypeScript
and SQLite tests).

```sh
npm ci
npm run db:migrate
npm run preview
```

Open http://localhost:8788. Preview uses **local D1**, independently of the remote
database. For UI development with hot reload, keep Pages preview running and run
`npm run dev` in a second terminal; Vite proxies `/api` to port 8788.

```sh
npm test
npm run typecheck
npm run build
npm run functions:build
```

## Data flow

The HTML has an immediate skeleton before JavaScript downloads. Octane renders
the full dashboard without waiting for a query. Each location loads D1 and its
primary sources concurrently. Provider results merge over DB results regardless
of completion order, so a late DB read never overwrites successful fresh data.
Weather sections can load and fail independently.

The client compares normalized values with DB rows and posts only changed/new
rows in batches of 25. The API validates coordinates, sources, units/ranges and
fixed PST timestamps, then executes parameterized UPSERTs. It independently skips
identical values and preserves omitted fields. Persistence never blocks display;
a failed write is visible and retried on the next refresh. There is no expiry or
staleness policy and no snapshot-per-refresh history.

- **Forecast weather:** Open-Meteo; batched coordinates, imperial units.
- **Recorded weather:** NWS station observations; station mappings are explicit
  in `src/config.ts`. These are nearby station measurements, not sensors at each
  requested coordinate. Units are converted to Fahrenheit, inches and mph.
- **Tides:** NOAA station predictions for future hours, measured water levels
  at exact hour boundaries for past hours, in feet relative to MLLW. The Pages
  proxy allowlists stations/products and propagates upstream failures.
- **Water temperature:** daily mean NOAA observations, with sample count and
  partial-day flag; Open-Meteo marine forecasts for future days (and today until
  observations are available).
- **Sunrise/sunset:** daily astronomical times from Open-Meteo.

Completed hourly intervals use observations per field. UV separately retains
its full-day modeled curve (with observations preferred when available), so
the daily maximum and chart do not lose morning hours as the day passes. Missing observations stay
missing; archived forecast data never masquerades as recorded rain. Rain totals
select a single station and exclude overlapping intervals. Exact interval bounds
are preserved because stations often report at minutes other than `:00`. Partial
coverage is visible; unknown rainfall never produces an all-clear runoff state.
Current in-progress hours use forecasts. All time/day boundaries are fixed
**PST (UTC−08:00, no daylight saving)**. See `user_todo.md` for follow-ups.

## Database

`migrations/0001_weather.sql` is the authoritative schema:

- `locations`: latitude/longitude in integer microdegrees form a composite key.
- `data_sources`: provider, dataset, station/model and actual source coordinates.
- `hourly_weather`: temperature, UV, rain, wind and weather code, with optional
  exact observation/rain interval timestamps.
- `hourly_tides`: height and datum.
- `daily_water_temperature`: daily mean, sample count, completeness.
- `daily_sun_times`: sunrise and sunset.

Each measurement is keyed to requested coordinates plus time/date, source and
observation/forecast kind where relevant. Provider grid coordinates are source
metadata, not replacement location keys. Future forecast values update in place;
observations are separate rows. Adding an hourly field is an `ALTER TABLE ... ADD
COLUMN` migration plus adapter/API/UI updates.

Client uploads are validated but remain client-reported; schema validation does
not authenticate provider provenance. Account credentials never enter browser
code. The public ingest API limits batch size, body size, sources, coordinates
and dates; deployment-level request limits can be added if public traffic needs
it. Non-browser callers can still submit fabricated values, so independently
verify source data before using this as an authoritative shared archive.

## Cloudflare

The remote `weatherdash` database is configured in `wrangler.toml`. Its initial
migration has been applied. No other database is used or modified. Local
migration state and data are in ignored `.wrangler/`.

```sh
npx wrangler login
npm run db:migrate:remote
npm run deploy
```

Deploy builds `dist/` and uploads Pages Functions with the `DB` binding. This
repository implementation does not itself imply the live Pages site has been
deployed. Pages' built-in SPA fallback handles region deep links; `_routes.json`
keeps static traffic out of Functions. No weather-provider API key is needed.

Regenerate binding types after changing Wrangler configuration:

```sh
npm run cf:types
```

Check provider usage terms before
changing the app's use or scale; Open-Meteo's public free API is for
noncommercial use.
