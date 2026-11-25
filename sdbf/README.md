# San Diego Beach Finder

An independent React and Vite PWA on Cloudflare Workers at [sdbeachfinder.gingernet.net](https://sdbeachfinder.gingernet.net/). The project uses its own package, Worker, install scope, and D1 binding. WeatherDash runs from the repository root as before.

Evidence Matrix pins the Beach and Safety score columns, followed by local rain, regional rain in last 96 hours, bacteria results and age, and the County posting. The map includes named monitoring points, towns, bays, and highways. Select a marker or select or hover a beach name to open the detail and runoff chart. The build includes the geographic basemap and can reopen with saved data offline.

## Run locally

From this directory:

```sh
npm ci
npm test
npm run build
node data/bootstrap.mjs > /tmp/sd-beach-finder-seed.sql
npx wrangler d1 execute sd-beach-finder --local --file=/tmp/sd-beach-finder-seed.sql
npx wrangler dev --local --port 8792
```

Local Browser Run uses D1 fallback. The deployed Worker runs County public pages in Browser Run. Versioned app assets and the last successful D1 snapshot are available offline.

## Data and deploy

The client requests D1 and the provider refresh in parallel. Provider writes take place through the Worker. It reconciles newer verified records and accepts refresh intent from the browser. The Worker obtains all evidence from its fixed upstreams. The **Refresh evidence** button requests reconciliation. Shared D1 leases keep traffic across clients within the same source intervals.

- County postings are refreshed on demand at most every 29 minutes. A 30-minute Worker schedule also checks for updates. The Worker treats the County’s general rain notice independently of local postings.
- County lab histories are checked every six hours. Each sample retains its station, method, unit, qualifier, and collection time.
- NWS gauge observations are checked at most every 15 minutes. Measured intervals account for gaps and overlaps. Open-Meteo coastal and inland coordinate series are checked at most every 29 minutes. Each inland point is about three miles east of its beach.
- NOAA, USGS, and Open-Meteo context is checked at most every 30 minutes. Tide, modeled weather and sea temperature, and river discharge are context for the detail view.
- Runoff scoring uses rainfall for every beach. The USGS San Diego River gauge provides river-flow context and the County environmental dashboard provides spill notices.

The initial D1 import seeded 15 monitoring sites, 341 Enterococcus results, 15 County postings, 257 mapped outfalls, and 112 measured precipitation intervals. The current schema and idempotent seed are in [data](data). After applying a required migration to the Beach Finder database, run `npm run deploy` here. The deployed Worker binds to the existing separate database in `wrangler.jsonc`.

See [rating rules and system design](docs/DESIGN.md). The original [design preview](preview/index.html) retains the dated design-review snapshot.
