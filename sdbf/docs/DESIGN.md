# San Diego Beach Finder

Evidence Matrix is the chosen layout. The starting view is a table of monitored ocean sites from Oceanside Pier to Border Field, with separate columns for County status, bacteria, coastal rain, and inland rain. Use a representative sampling point every few miles. Display the exact station under the public beach name so the result has a clear geographic scope. Keep all 15 sites available in the map view.

## Safety score

The table pins the Beach and Safety score columns, then shows local rain over 72 hours, regional rain in last 96 hours, the latest bacteria test, and the County status. Lower scores appear first, with geography breaking ties. The map and score markers use the selected Earth & Ember palette: forest and leaf greens (1–3), golden yellow at the unchanged breakpoint of 4, warm oranges (5–7), and brick to deep reds (8–10). The ten colors are `#365b32`, `#5b803b`, `#97ad50`, `#e5cc62`, `#dca94c`, `#cd873e`, `#bc6436`, `#aa4433`, `#8a302e`, and `#64282b`. The legend uses dark text on scores 3–7 and white text on the darker scores to keep the numerals readable. Its markers and names open the beach detail. The [published methodology](../public/methodology.html) documents the score levels, thresholds and source limitations.

The strongest signal sets the base score. Regional rainfall is the equal-weight average of each beach’s inland 96-hour estimate and its region’s highest coastal 72-hour total. It uses the former inland risk bands (3 at 0.35″, 4 at 0.75″, 5 at 1.00″, 6 at 1.25″). The stronger local or regional rainfall signal sets the rain score; there is no separate inland signal or additive regional penalty. Crossing a runoff limit sets at least 6, an official Countywide rain advisory sets at least 7, and heavy rain alone can reach 8. Local County advisories add 6 points, warnings add 8, and closures add 10 after the base score, capped at 10. Nearby local postings contribute 70% of those penalties within 2 miles, 25% over 2 and up to 4 miles, and zero beyond 4 miles, rounded to whole points. Only the strongest direct or nearby County penalty applies. Verified spills reach 10. All beaches use the same runoff rules based on coastal rainfall and a point about three miles inland. Unverified County postings or County rain advisory status have their own floors. The app uses the available rainfall estimates. A last lab result at or above the limit and older than 72 hours sets a floor of 6. An otherwise clear beach starts at 1, including when its most recent below-limit result is old. Map colors describe the score at each monitoring point. Shoreline segments between monitoring points have no assigned score.

The detail highlights hazards in bold red and puts current evidence above the chart. It shows local daily rain, the local three-day total, and a regional curve averaging inland four-day rain with the regional coastal three-day maximum, adapted to four past days and ten forecast days. Historic rainfall observations and forecast hours are separated by the today marker. Recent bacteria samples remain available as a short table.

Sources

- [San Diego County current postings and sample reports](https://www.sdbeachinfo.com/)
- [County thresholds and outfall guidance](https://www.sandiegocounty.gov/content/dam/sdc/deh/lwqd/Beach%26Bay/DEHQ_bb_public_summary.pdf)
- [County 0.20 inch and 72-hour guidance](https://www.sandiegocounty.gov/content/dam/sdc/deh/lwqd/Beach%26Bay/DEHQ_bb_advisory_explanation.pdf)
- [California BeachWatch station metadata and archive](https://data.ca.gov/@california-state-water-resources-control-board/beach-water-quality-postings-and-closures)
- [County sewage and spill dashboard](https://www.sandiegocounty.gov/content/sdc/hhsa/programs/phs/community_epidemiology/south-region-health-concerns/Environmental-Dashboard.html)
- [Scripps pathogen forecasting](https://pfmweb.ucsd.edu/)
- [NWS API](https://www.weather.gov/documentation/services-web-api)
- [Census hydrography](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer) and [Census highway geometry](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer)

## Beach detail appearance

The selected **Everyday Japanese** treatment applies only to the map-click beach detail dialog. It uses warm off-white (`#f8f6f0`), charcoal (`#292b28`), pale neutral inset surfaces (`#eeece6`), oxblood accents (`#6f2428`), and bundled Atkinson Hyperlegible fonts. Warnings use `#852d31`; the score marker retains its score-dependent color. Controls and the dialog have restrained squared corners.

`src/beach-detail.css` scopes the treatment to `dialog.beach-detail`. The dialog keeps the existing content order, hazard prioritization, runoff chart, disclosures, native modal behavior, Escape dismissal, and return of focus to the map marker. The map and debug table retain their existing styles. The local design comparison remains at `preview/modal-options/`.

## System design

An independent React and Vite entry point, service worker, Cloudflare Worker and D1 database serve the PWA. The HTML renders a skeleton while the bundle loads. The service worker caches the versioned shell and latest saved D1 evidence. The rating recomputes from evidence timestamps when the app opens and while it is running.

The client reads D1 and requests source refresh in parallel. It keeps the latest verified snapshot regardless of arrival order. A manual client request asks the Worker to reconcile the database with its allowlisted upstreams. D1 grants a shared lease per source, and an upsert only replaces an older verified feed. The browser submits refresh intent. The Worker obtains the evidence from the source. Source publication, verification, and lab collection times remain distinct.

The Worker opens the County’s public map and station report screens through Browser Run. It carries forward known restrictions when an upstream response is unavailable or incomplete. Lifting a Countywide notice requires a newer County update and a complete advisory feed. Missing station reports retain their previously verified lab records. The Worker fetches NWS precipitation observations from nearby stations, and uses normalized nonoverlapping intervals for known rain totals. Open-Meteo supplies coastal rain series and one raw inland series per beach at a point about three miles east, using a new D1 feed row and the existing source refresh lease. The 72- and 96-hour windows include only hours that had ended when the model response was fetched. The gauge and grid feeds supply independent coastal estimates. For inland rainfall the client combines each point with other raw inland points using a smooth distance falloff rather than a hard cutoff, so a heavy reading inland of one beach still registers down the coast from La Jolla Shores to Oceanside. Each hour uses the maximum of its own reading and distance-weighted increases from nearby points, so sharing errs toward the higher reading. The inland series remains an internal input to the regional average. The table, score, and runoff chart expose only local and regional rain. The regional explainer describes delayed inland runoff, nutrient-driven algal growth, and runoff carried north or south along the coast. Factor colors use the final score decrease on removal: red at 4+ points, dark yellow at 2–3, otherwise normal.

The detail view includes NOAA tide and water temperature observations, Open-Meteo weather and modeled sea temperature, and USGS San Diego River discharge where applicable. The County environmental dashboard supplies additional field and spill information. The site is deployed at `sdbeachfinder.gingernet.net`, with an independent D1 binding and PWA scope.

## Typography

Atkinson Hyperlegible is the app-wide family, including map captions, beach details, and runoff chart labels. Regular, bold, and italic faces are self-hosted in `src/assets/fonts/` with their OFL license. Existing type sizes, spacing, and colors are preserved.
