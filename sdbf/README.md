# San Diego Beach Finder

The separate branch contains the Evidence Matrix preview, rating logic, monitoring-site catalog, and database schema. The production React app and custom hostname deployment are pending.

Open [Evidence Matrix](preview/index.html) in a browser. Switch between the evidence table and a geographic map, then choose a listed beach or pin for its sample history and runoff details. The map and water-quality snapshot are bundled for offline preview.

- [System design and rating rules](docs/DESIGN.md)
- [Layout decision record](docs/CHOICE_SET.yaml)
- [Station catalog](data/sites.json)
- [D1 schema](data/0001.sql)

## Initial import

The Nov 22, 2026 import populated and verified 15 sites, 15 County map postings, 341 Enterococcus results, 257 County storm-drain or outfall records, and 112 measured precipitation intervals from five NWS gauges in the separate `sd-beach-finder` D1 database. The County map reported its last update at 2:55 p.m. Pacific on Nov 21. Its snapshot showed advisories at 12 representative sites and closures at Silver Strand, Imperial Beach Pier and Border Field. The newest result found in the public station reports was collected on Nov 12, and the oldest latest result was collected on Oct 19. The source only provided partial precipitation coverage.

A follow-up check at 4:07 p.m. Pacific on Nov 22 confirmed the County’s general rain advisory from the Nov 19 storm. It covered the entire project coastline and the bays, with a tentative lift around 5 p.m. The comparison preserves that checked snapshot.

The first import used the County's public site and station report views in a browser. A direct request to the County report endpoint returned HTTP 403. A supported production ingestion path still needs verification. The comparison uses the public map's posting classifications without inferring why a site was posted. Outfall coordinates identify potential runoff locations. They do not report whether a drain was flowing at the time.

Run the rating checks with `node --test sdbf/data/rating.test.mjs`.

Build portable table-first and map-first HTML files with `node sdbf/preview/render.mjs <output-directory>`.
