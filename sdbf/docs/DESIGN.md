# San Diego Beach Finder

Evidence Matrix is the chosen layout. The starting view is a table of monitored ocean sites from Oceanside Pier to Border Field, with separate columns for County postings, bacteria, rain, and mapped outfalls. Use a representative sampling point every few miles. Display the exact station under the public beach name so the result has a clear geographic scope. Keep all 15 sites available in the map view.

## Rating rules

Answer “Can I swim anywhere now?” above both views. Show an active coastwide water-quality restriction or count of lower-concern candidates. Keep the water-quality rating for each sampling point visible underneath, so a regional rain advisory leaves local closures and readings available. Show source-confirmed times and link to the County. Rank by category only, with north-to-south geography as the tie-breaker.

| State | Rule |
| --- | --- |
| Avoid water contact | County closure, warning, or site advisory; verified spill or water-quality warning covering the site; latest comparable sample at or above its limit. Keep a previously observed restriction visible if current status is unavailable. |
| Avoid after rain | Apply the hold to the full coast during a County general rain advisory or a verified qualifying storm in coastal or valley areas (at least 0.20 inches), and for 72 hours after the rain ends. One dry gauge or good sample cannot clear a beach. Keep the official hold until the County confirms the lift. An estimated lift is informational. |
| Insufficient data | Missing, stale, or contradictory County status, unverified coastwide rain status, incomplete gauge coverage, missing applicable runoff evidence, or no comparable sample collected within 48 hours. Show what evidence is missing. |
| Recent test below limit | Explicit current County open status, current coastwide status and complete rain coverage, clear applicable runoff evidence, and a comparable below-limit sample within 48 hours that postdates any known hazard. Use this label with its sample age and the County link. |

The 48-hour sample window and 12-hour successful County fetch window are conservative app policies. The County gives 1,413 DNA copies per 100 mL for Enterococcus ddPCR and 104 organisms per 100 mL for the culture single-sample method. Apply thresholds only to validated measurements of the matching method and unit. Keep censored measurements as bounds. For a date without a sample time, calculate freshness conservatively from local midnight, and require the entire possible interval to be after a hazard before using the sample to clear that hazard. Daily or weekly sampling schedules do not extend the useful life of a result.

The detail view should show sample time, result, unit, method, difference from the threshold, County status and verification time, nearby outfall and mapped spill information, storm total and end time, and the measurement window. Align bacteria, rain, and runoff charts to a shared 30-day time axis. Keep days without a sample visibly blank. Distinguish observed precipitation, forecast weather and modeled plume risk. Keep the rating and evidence views focused on water quality.

County guidance directs users to avoid contact within 75 feet of runoff. Show a separately labeled outfall layer. Use colored station markers on a geographic basemap with towns, bays, and major highways. Leave the shoreline neutral between stations unless an official posting supplies an affected segment. Highlight the selected point and show its evidence alongside the map. The preview bundles simplified U.S. Census TIGERweb hydrography and transportation geometry for offline display.

Sources

- [San Diego County current postings and sample reports](https://www.sdbeachinfo.com/)
- [County thresholds and outfall guidance](https://www.sandiegocounty.gov/content/dam/sdc/deh/lwqd/Beach%26Bay/DEHQ_bb_public_summary.pdf)
- [County 0.20 inch and 72-hour guidance](https://www.sandiegocounty.gov/content/dam/sdc/deh/lwqd/Beach%26Bay/DEHQ_bb_advisory_explanation.pdf)
- [California BeachWatch station metadata and archive](https://data.ca.gov/@california-state-water-resources-control-board/beach-water-quality-postings-and-closures)
- [County sewage and spill dashboard](https://www.sandiegocounty.gov/content/sdc/hhsa/programs/phs/community_epidemiology/south-region-health-concerns/Environmental-Dashboard.html)
- [Scripps pathogen forecasting](https://pfmweb.ucsd.edu/)
- [NWS API](https://www.weather.gov/documentation/services-web-api)
- [Census hydrography](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer) and [Census highway geometry](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer)

## System design

Use an independent React and Vite entry point, service worker, Cloudflare Worker and D1 database. The installable shell renders a CSS skeleton straight from HTML. Cache versioned assets for offline use and recalculate status freshness from evidence timestamps every time the user opens the app. Link to County postings and signs from each detail view.

Use WeatherDash's parallel source-and-database pattern. The client starts a trusted-source request and cached D1 read together. Merge per provider and site, preferring newer verified evidence independent of response order. If a source result differs, the client can request persistence by submitting a short-lived server-signed batch, with provider identity, keys, values and fetch time bound to the signature. The Worker validates the batch and upserts only if verification time advances. An offline or untrusted client cannot manufacture a shared open status. Preserve sample time, source publication time where available, and verification time independently. Expired records remain available for history, with restrictions retained conservatively until superseded.

Reuse the Open-Meteo weather and marine sources, NWS observations and NOAA tide and water temperature sources through SD-specific station mappings. Use measured rain intervals and report gaps. A modeled rain estimate is context when local gauge coverage is incomplete. Add County site postings, station-specific bacteriology, County storm drain locations, and the South County sewage/runoff context. Use the USIBWC flow and spill sources or Scripps model as separately labeled supplementary evidence once station/segment coverage and freshness are verified.

The first public release should use the chosen layout at `sdbeachfinder.gingernet.net`, with an independent deploy root, D1 binding, and install scope.
