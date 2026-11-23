# San Diego Beach Finder

Evidence Matrix is the chosen layout. The starting view is a table of monitored ocean sites from Oceanside Pier to Border Field, with separate columns for County postings, bacteria, coastal rain, and inland rain. Use a representative sampling point every few miles. Display the exact station under the public beach name so the result has a clear geographic scope. Keep all 15 sites available in the map view.

## Safety score

The table pins the Beach and Safety score columns, then shows local rain over 72 hours, inland rain over four days, the latest bacteria test, and the County posting. Lower scores appear first, with geography breaking ties. The map uses the same ten green-to-red colors and labels. Its markers and names open the beach detail. The [published methodology](../public/methodology.html) documents the score levels, thresholds and source limitations.

The strongest signal sets the score, so a severity floor stays in effect even when other evidence looks favorable. Crossing a runoff limit sets at least 6, a coastwide rain hold sets at least 7, and heavy rain alone can reach 8. County warnings, closures, and verified spills reach 10. All beaches use the same runoff rules based on coastal rainfall and a point about three miles inland. Unavailable County or rainfall evidence has its own floor. A last lab result at or above the limit and older than 72 hours sets a floor of 6. An otherwise clear beach starts at 1, including when its most recent below-limit result is old. Map colors describe the score at each monitoring point. Shoreline segments between monitoring points have no assigned score.

The detail highlights hazards in bold red and puts current evidence above the chart. It uses WeatherDash’s daily local and inland bars with rolling totals and threshold lines, adapted to three local days and four inland days. Historic rainfall estimates and forecast hours are separated by the today marker. Recent bacteria samples remain available as a short table.

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

An independent React and Vite entry point, service worker, Cloudflare Worker and D1 database serve the PWA. The HTML renders a skeleton while the bundle loads. The service worker caches the versioned shell and latest saved D1 evidence. The rating recomputes from evidence timestamps when the app opens and while it is running.

The client reads D1 and requests source refresh in parallel. It keeps the latest verified snapshot regardless of arrival order. A manual client request asks the Worker to reconcile the database with its allowlisted upstreams. D1 grants a shared lease per source, and an upsert only replaces an older verified feed. The browser submits refresh intent. The Worker obtains the evidence from the source. Source publication, verification, and lab collection times remain distinct.

The Worker opens the County’s public map and station report screens through Browser Run. It carries forward known restrictions when an upstream response is unavailable or incomplete. Lifting a Countywide notice requires a newer County update and a complete advisory feed. Missing station reports retain their previously verified lab records. The Worker fetches NWS precipitation observations from nearby stations, distinguishes incomplete coverage from zero rainfall, and uses normalized nonoverlapping intervals for known rain totals. Open-Meteo supplies coastal rain series and one distinct inland series per beach at a point about three miles east, using a new D1 feed row and the existing source refresh lease. The 72- and 96-hour windows include only hours that had ended when the model response was fetched. The app keeps measured gauge minimums distinct from grid estimates.

The detail view includes NOAA tide and water temperature observations, Open-Meteo weather and modeled sea temperature, and USGS San Diego River discharge where applicable. The County environmental dashboard supplies additional field and spill information. The site is deployed at `sdbeachfinder.gingernet.net`, with an independent D1 binding and PWA scope.
